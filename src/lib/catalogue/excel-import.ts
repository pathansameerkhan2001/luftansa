/**
 * Excel product import: pure logic (no I/O, no server-only imports), shared by
 * the admin import page, the import API and the tests.
 *
 *   spreadsheet matrix ──autoMapColumns/extractRows──▶ raw rows (as typed in the file)
 *   raw rows ──validateRows──▶ valid rows + row issues (field errors, duplicates, conflicts)
 *   valid rows + existing products ──planImport──▶ plan (what would be created/updated) + totals
 *
 * Organisation: one product per Product Name (case-insensitive); each row is a
 * variant identified by type + size (e.g. Spray 30 ml, Roll-On 8 ml). The
 * product's type is the type most of its rows use; variants of another type
 * are labelled with it ("8 ml Roll-On") so the storefront size selector stays clear.
 *
 * Nothing is written here. The server applies a plan (./excel-import-apply.ts)
 * only after the admin confirmed it and only if the plan is still identical
 * (fingerprint).
 */
import { z } from "zod";
import type { FragranceNotes, ProductTypeItem, ProductTypeUnit, ProductVariantItem, ProductItem } from "@/lib/db/schemas";

/* ------------------------------------------------------------------ fields --- */

export const IMPORT_FIELDS = ["name", "type", "size", "price", "category", "stock", "sku", "notes"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export const REQUIRED_IMPORT_FIELDS: readonly ImportField[] = ["name", "type", "size", "price", "category", "stock", "sku"];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  name: "Product name",
  type: "Type",
  size: "Size",
  price: "Price (₹)",
  category: "Category",
  stock: "Stock",
  sku: "SKU",
  notes: "Fragrance notes",
};

/** Header names recognised automatically (compared lower-case, spaces collapsed). */
const HEADER_SYNONYMS: Record<ImportField, readonly string[]> = {
  name: ["product name", "product", "name", "fragrance", "fragrance name", "perfume", "perfume name"],
  type: ["type", "product type", "format", "variant type"],
  size: ["size", "size (ml)", "capacity", "volume", "ml"],
  price: ["price", "price (inr)", "price (₹)", "selling price", "rate"],
  category: ["category", "collection"],
  stock: ["stock", "stock quantity", "quantity", "qty", "inventory"],
  sku: ["sku", "sku code", "item code"],
  notes: ["notes", "fragrance notes", "scent notes"],
};

export const MAX_IMPORT_ROWS = 2000;
export const MAX_VARIANTS_PER_PRODUCT = 20;

export type CellValue = string | number | boolean | null;
export type ColumnMapping = Partial<Record<ImportField, number>>;

const normHeader = (h: unknown) => String(h ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Suggests which column holds each field. Exact header names win; otherwise a
 * header that starts with a known name ("Type (Spray or Roll on)"). A column is
 * used for one field at most.
 */
export function autoMapColumns(headers: readonly unknown[]): ColumnMapping {
  const names = headers.map(normHeader);
  const used = new Set<number>();
  const mapping: ColumnMapping = {};
  for (const pass of ["exact", "prefix"] as const) {
    for (const field of IMPORT_FIELDS) {
      if (mapping[field] !== undefined) continue;
      const idx = names.findIndex(
        (n, i) => !used.has(i) && n !== "" && HEADER_SYNONYMS[field].some((s) => (pass === "exact" ? n === s : n.startsWith(`${s} `) || n.startsWith(`${s}(`))),
      );
      if (idx >= 0) {
        mapping[field] = idx;
        used.add(idx);
      }
    }
  }
  return mapping;
}

/** First row that has at least two non-empty cells (the header row). */
export function findHeaderRow(matrix: readonly (readonly CellValue[])[]): number {
  const i = matrix.findIndex((r) => r.filter((c) => c !== null && String(c).trim() !== "").length >= 2);
  return i < 0 ? 0 : i;
}

/* -------------------------------------------------------------------- rows --- */

export const rawImportRowSchema = z.object({
  /** Spreadsheet row number as Excel shows it (header row included). */
  rowNumber: z.number().int().min(1).max(1_000_000),
  values: z.object(
    Object.fromEntries(IMPORT_FIELDS.map((f) => [f, z.union([z.string().max(1000), z.number(), z.null()]).optional()])) as Record<
      ImportField,
      z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodNull]>>
    >,
  ),
});
export type RawImportRow = z.infer<typeof rawImportRowSchema>;

/** Rows below the header, using the mapping. Completely empty rows are skipped. */
export function extractRows(matrix: readonly (readonly CellValue[])[], mapping: ColumnMapping, headerRow = findHeaderRow(matrix)): RawImportRow[] {
  const rows: RawImportRow[] = [];
  for (let r = headerRow + 1; r < matrix.length; r++) {
    const line = matrix[r] ?? [];
    const values: RawImportRow["values"] = {};
    let any = false;
    for (const field of IMPORT_FIELDS) {
      const col = mapping[field];
      if (col === undefined) continue;
      const cell = line[col];
      const v = cell === null || cell === undefined ? null : typeof cell === "boolean" ? String(cell) : cell;
      if (v !== null && String(v).trim() !== "") any = true;
      values[field] = typeof v === "string" ? v.slice(0, 1000) : v;
    }
    if (any) rows.push({ rowNumber: r + 1, values });
  }
  return rows;
}

/* ------------------------------------------------------------------ parsing --- */

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v)).replace(/\s+/g, " ").trim();

export function normalizeProductName(v: unknown): string {
  return text(v);
}
export const productKeyOf = (name: string) => name.toLowerCase();

/** "BLACK VELVET" → "Black Velvet"; short all-caps words ("CK") are kept. Mixed-case names are left alone. */
export function toTitleCase(name: string): string {
  if (name !== name.toUpperCase()) return name;
  return name
    .split(" ")
    .map((w) => (w.length <= 2 ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

const UNITS: Record<string, ProductTypeUnit> = { ml: "ml", g: "g", gm: "g", gms: "g", oz: "oz", pcs: "pieces", pieces: "pieces", units: "units" };

/** "30 ml", 30, "8ML", "100" (ml assumed) → capacity + unit. */
export function parseSize(v: unknown): { capacity: number; unit: ProductTypeUnit } | null {
  const s = text(v).toLowerCase().replace(",", ".");
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([a-z]*)$/);
  if (!m) return null;
  const capacity = Number(m[1]);
  const unit = m[2] ? UNITS[m[2]] : "ml";
  if (!unit || !(capacity > 0) || capacity > 10000) return null;
  return { capacity, unit };
}

/** "₹1,299", 1299, "1299.00" → 1299. Rupee amounts must be whole numbers. */
export function parseRupees(v: unknown): number | null {
  if (typeof v === "number") return Number.isInteger(v) && v >= 1 && v <= 10_000_000 ? v : null;
  const s = text(v).replace(/^(₹|rs\.?|inr)\s*/i, "").replace(/,/g, "");
  if (!/^\d+(\.0+)?$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 10_000_000 ? n : null;
}

export function parseStock(v: unknown): number | null {
  if (typeof v === "number") return Number.isInteger(v) && v >= 0 && v <= 1_000_000 ? v : null;
  const s = text(v).replace(/,/g, "");
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n <= 1_000_000 ? n : null;
}

const SKU = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
export function normalizeSku(v: unknown): string | null {
  const s = text(v).toUpperCase();
  return SKU.test(s) ? s : null;
}

/** Comparison key for a Type value ("Roll-On", "roll on", "ROLLON" → "rollon"). */
export const typeKey = (v: unknown) => text(v).toLowerCase().replace(/[^a-z0-9]/g, "");

/** Suggested product type for a Type value, by name or id (admin confirms in the mapping step). */
export function suggestProductType(value: string, types: readonly Pick<ProductTypeItem, "id" | "name">[]): string | undefined {
  const k = typeKey(value);
  if (!k) return undefined;
  const exact = types.find((t) => typeKey(t.name) === k || typeKey(t.id) === k);
  if (exact) return exact.id;
  // "Spray" → "Perfume Spray"; "Roll on" → "Roll-On"
  const partial = types.filter((t) => typeKey(t.name).includes(k) || k.includes(typeKey(t.name)));
  return partial.length === 1 ? partial[0].id : undefined;
}

const NOTE_GROUPS: Record<string, keyof FragranceNotes> = { top: "top", middle: "heart", heart: "heart", base: "base" };

/** "Top: Lavender; Pear | Middle: Amber | Base: Vanilla" → notes. Empty → null (no notes). */
export function parseNotes(v: unknown): { notes: FragranceNotes | null; error?: string } {
  const s = text(v);
  if (!s) return { notes: null };
  const notes: FragranceNotes = { top: [], heart: [], base: [] };
  for (const part of s.split("|").map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^([A-Za-z ]+?)\s*(?:notes?)?\s*:\s*(.*)$/i);
    const group = m ? NOTE_GROUPS[m[1].trim().toLowerCase()] : undefined;
    if (!m || !group) return { notes: null, error: 'Write notes as "Top: … | Middle: … | Base: …"' };
    const names = m[2].split(/[;,]/).map((n) => n.trim()).filter(Boolean);
    for (const name of names) {
      if (name.length > 64) return { notes: null, error: `Note "${name.slice(0, 20)}…" is longer than 64 characters` };
      const id = slugify(name) || `note-${notes[group].length + 1}`;
      if (!notes[group].some((n) => n.id === id)) notes[group].push({ id, name });
    }
    if (notes[group].length > 10) return { notes: null, error: "At most 10 notes per group (Top, Middle, Base)" };
  }
  return { notes };
}

const notesSignature = (n: FragranceNotes | null) => (n ? (["top", "heart", "base"] as const).map((g) => n[g].map((x) => x.name.toLowerCase()).join(",")).join("|") : "");

/* --------------------------------------------------------------- validation --- */

export interface RowIssue {
  rowNumber: number;
  field?: ImportField;
  message: string;
  /** "error": row not imported. "duplicate": identical repeat, skipped. */
  kind: "error" | "duplicate";
}

export interface ValidRow {
  rowNumber: number;
  productKey: string;
  name: string;
  productTypeId: string;
  productTypeName: string;
  capacity: number;
  unit: ProductTypeUnit;
  priceInr: number;
  category: string;
  stockQuantity: number;
  sku: string;
  notes: FragranceNotes | null;
}

export interface ValidationContext {
  /** typeKey(Type value) → product type id, as confirmed in the mapping step. */
  typeMap: Record<string, string>;
  productTypes: readonly Pick<ProductTypeItem, "id" | "name">[];
  titleCaseNames: boolean;
}

export interface ValidationResult {
  valid: ValidRow[];
  issues: RowIssue[];
  totalRows: number;
}

const variantKeyOf = (r: Pick<ValidRow, "productKey" | "productTypeId" | "capacity" | "unit">) => `${r.productKey}|${r.productTypeId}|${r.capacity}|${r.unit}`;
const sameContent = (a: ValidRow, b: ValidRow) =>
  a.priceInr === b.priceInr && a.stockQuantity === b.stockQuantity && a.sku === b.sku && a.category === b.category && notesSignature(a.notes) === notesSignature(b.notes);

/**
 * Field validation, then file-level checks: identical repeats (duplicates,
 * skipped), conflicting repeats, SKUs shared by different variants, and
 * product-level consistency (category, notes, variant count, name/slug clashes).
 * If any row of a product has an error, the product's other rows are held back
 * too, so a product is never imported with variants missing.
 */
export function validateRows(rows: readonly RawImportRow[], ctx: ValidationContext): ValidationResult {
  const issues: RowIssue[] = [];
  const err = (rowNumber: number, message: string, field?: ImportField) => issues.push({ rowNumber, field, message, kind: "error" });
  const typeNames = new Map(ctx.productTypes.map((t) => [t.id, t.name]));
  const parsed: ValidRow[] = [];
  const productKeyByRow = new Map<number, string>();

  for (const row of rows.slice(0, MAX_IMPORT_ROWS)) {
    const v = row.values;
    const before = issues.length;
    const rawName = normalizeProductName(v.name);
    if (!rawName) err(row.rowNumber, "Product name is missing", "name");
    else if (rawName.length > 120) err(row.rowNumber, "Product name is longer than 120 characters", "name");
    const name = ctx.titleCaseNames ? toTitleCase(rawName) : rawName;
    if (rawName) productKeyByRow.set(row.rowNumber, productKeyOf(rawName));

    const typeText = text(v.type);
    const productTypeId = typeText ? ctx.typeMap[typeKey(typeText)] : undefined;
    if (!typeText) err(row.rowNumber, "Type is missing", "type");
    else if (!productTypeId || !typeNames.has(productTypeId)) err(row.rowNumber, `Type "${typeText}" is not matched to a product type`, "type");

    const size = parseSize(v.size);
    if (!text(v.size)) err(row.rowNumber, "Size is missing", "size");
    else if (!size) err(row.rowNumber, `Size "${text(v.size)}" is not a size such as 30 ml`, "size");

    const price = parseRupees(v.price);
    if (!text(v.price)) err(row.rowNumber, "Price is missing", "price");
    else if (price === null) err(row.rowNumber, `Price "${text(v.price)}" must be a whole rupee amount of at least 1`, "price");

    const category = text(v.category);
    if (!category) err(row.rowNumber, "Category is missing", "category");
    else if (category.length > 64) err(row.rowNumber, "Category is longer than 64 characters", "category");

    const stock = parseStock(v.stock);
    if (!text(v.stock)) err(row.rowNumber, "Stock is missing", "stock");
    else if (stock === null) err(row.rowNumber, `Stock "${text(v.stock)}" must be a whole number, 0 or more`, "stock");

    const sku = normalizeSku(v.sku);
    if (!text(v.sku)) err(row.rowNumber, "SKU is missing", "sku");
    else if (!sku) err(row.rowNumber, `SKU "${text(v.sku)}" may only use letters, numbers, - . _ (max 64)`, "sku");

    const notes = parseNotes(v.notes);
    if (notes.error) err(row.rowNumber, notes.error, "notes");

    if (issues.length === before) {
      parsed.push({
        rowNumber: row.rowNumber, productKey: productKeyOf(rawName), name, productTypeId: productTypeId!, productTypeName: typeNames.get(productTypeId!)!,
        capacity: size!.capacity, unit: size!.unit, priceInr: price!, category, stockQuantity: stock!, sku: sku!, notes: notes.notes,
      });
    }
  }
  for (const row of rows.slice(MAX_IMPORT_ROWS)) err(row.rowNumber, `Only the first ${MAX_IMPORT_ROWS} rows can be imported at once`);

  // Repeats of the same product + type + size.
  const byVariant = new Map<string, ValidRow[]>();
  for (const r of parsed) byVariant.set(variantKeyOf(r), [...(byVariant.get(variantKeyOf(r)) ?? []), r]);
  const dropped = new Set<number>();
  for (const group of byVariant.values()) {
    if (group.length < 2) continue;
    if (group.every((r) => sameContent(r, group[0]))) {
      for (const r of group.slice(1)) {
        issues.push({ rowNumber: r.rowNumber, kind: "duplicate", message: `Same as row ${group[0].rowNumber}: skipped` });
        dropped.add(r.rowNumber);
      }
    } else {
      const list = group.map((r) => r.rowNumber).join(", ");
      for (const r of group) err(r.rowNumber, `Rows ${list} are the same product, type and size with different values`);
    }
  }

  // A SKU may identify only one variant.
  const bySku = new Map<string, ValidRow[]>();
  for (const r of parsed.filter((r) => !dropped.has(r.rowNumber))) bySku.set(r.sku, [...(bySku.get(r.sku) ?? []), r]);
  for (const [sku, group] of bySku) {
    if (new Set(group.map(variantKeyOf)).size > 1) {
      const list = group.map((r) => r.rowNumber).join(", ");
      for (const r of group) err(r.rowNumber, `SKU ${sku} is used on rows ${list} for different variants`, "sku");
    }
  }

  // Product-level consistency.
  const byProduct = new Map<string, ValidRow[]>();
  for (const r of parsed.filter((r) => !dropped.has(r.rowNumber))) byProduct.set(r.productKey, [...(byProduct.get(r.productKey) ?? []), r]);
  const slugOwner = new Map<string, string>();
  for (const [key, group] of byProduct) {
    const rowsText = group.map((r) => r.rowNumber).join(", ");
    if (new Set(group.map((r) => r.category.toLowerCase())).size > 1) for (const r of group) err(r.rowNumber, `Category differs between rows ${rowsText} of this product`, "category");
    const withNotes = group.filter((r) => r.notes);
    if (new Set(withNotes.map((r) => notesSignature(r.notes))).size > 1) for (const r of withNotes) err(r.rowNumber, `Notes differ between rows of this product`, "notes");
    if (group.length > MAX_VARIANTS_PER_PRODUCT) for (const r of group) err(r.rowNumber, `A product can have at most ${MAX_VARIANTS_PER_PRODUCT} variants`);
    const slug = slugify(group[0].name);
    if (!slug) for (const r of group) err(r.rowNumber, "Product name needs at least one letter or number", "name");
    else if (slugOwner.has(slug) && slugOwner.get(slug) !== key) for (const r of group) err(r.rowNumber, `Product name is too similar to another product in the file (same web address "${slug}")`, "name");
    else slugOwner.set(slug, key);
  }

  return finalize(parsed, dropped, issues, rows, productKeyByRow);
}

/** Holds back every row of a product that has any error. */
function finalize(parsed: ValidRow[], dropped: Set<number>, issues: RowIssue[], rows: readonly RawImportRow[], productKeyByRow: Map<number, string>): ValidationResult {
  const errorRows = new Set(issues.filter((i) => i.kind === "error").map((i) => i.rowNumber));
  const blockedProducts = new Map<string, number>();
  for (const n of [...errorRows].sort((a, b) => a - b)) {
    const key = productKeyByRow.get(n);
    if (key && !blockedProducts.has(key)) blockedProducts.set(key, n);
  }
  const valid: ValidRow[] = [];
  for (const r of parsed) {
    if (dropped.has(r.rowNumber) || errorRows.has(r.rowNumber)) continue;
    const blockedBy = blockedProducts.get(r.productKey);
    if (blockedBy !== undefined) {
      issues.push({ rowNumber: r.rowNumber, kind: "error", message: `Held back: row ${blockedBy} of the same product has an error` });
      continue;
    }
    valid.push(r);
  }
  issues.sort((a, b) => a.rowNumber - b.rowNumber);
  return { valid, issues, totalRows: rows.length };
}

/* ------------------------------------------------------------------ planning --- */

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export interface PlannedVariant {
  action: "create" | "update" | "unchanged";
  variantId: string;
  rowNumber: number;
  existingVersion?: number;
  capacity: number;
  unit: ProductTypeUnit;
  label: string;
  priceInr: number;
  stockQuantity: number;
  sku: string;
  sortOrder: number;
  changes: FieldChange[];
}

export interface PlannedProduct {
  /** create: new product. update: existing product changes (applied only with "update existing"). skip: existing product with changes, updates not enabled. unchanged: nothing to do. */
  action: "create" | "update" | "skip" | "unchanged";
  productId: string;
  name: string;
  existingVersion?: number;
  productTypeId: string;
  productTypeName: string;
  category: string;
  notes: FragranceNotes | null;
  sizes: number[];
  status: "ACTIVE" | "INACTIVE";
  changes: FieldChange[];
  variants: PlannedVariant[];
  rows: number[];
}

export interface ImportOptions {
  /** Apply changes to products that already exist. Off: they are reported and skipped. */
  updateExisting: boolean;
  /** New products are visible on the website immediately. Off: created as Hidden (INACTIVE). */
  activateNewProducts: boolean;
}

export interface ImportTotals {
  rows: number;
  newProducts: number;
  newVariants: number;
  /** Existing products and variants whose stored values would change. */
  existingRecordsToUpdate: number;
  existingProductsAffected: number;
  /** Existing products with differences that are skipped because updates are off. */
  existingSkipped: number;
  unchangedRows: number;
  duplicates: number;
  invalidRows: number;
}

export interface ImportPlan {
  products: PlannedProduct[];
  issues: RowIssue[];
  totals: ImportTotals;
  fingerprint: string;
}

export interface ExistingProduct {
  product: Pick<ProductItem, "id" | "name" | "version" | "productTypeId" | "productTypeName" | "category" | "notes" | "sizes" | "status">;
  variants: Pick<ProductVariantItem, "id" | "sk" | "capacity" | "sizeMl" | "unit" | "label" | "priceInr" | "stockQuantity" | "sku" | "status" | "sortOrder" | "version">[];
}

const variantIdOf = (v: ExistingProduct["variants"][number]) => v.id ?? v.sk.replace("VARIANT#", "");
const variantIdFromSku = (sku: string) => `v_${sku.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`.slice(0, 64);
const fmt = (v: unknown) => (v === undefined || v === null || v === "" ? "not set" : String(v));
const fmtNotes = (n: FragranceNotes | null | undefined) =>
  n && (n.top.length || n.heart.length || n.base.length)
    ? `Top: ${n.top.map((x) => x.name).join(", ") || "-"} · Middle: ${n.heart.map((x) => x.name).join(", ") || "-"} · Base: ${n.base.map((x) => x.name).join(", ") || "-"}`
    : "none";

function mostCommonType(rows: readonly ValidRow[]): { id: string; name: string } {
  const counts = new Map<string, { n: number; first: number; name: string }>();
  rows.forEach((r, i) => {
    const c = counts.get(r.productTypeId) ?? { n: 0, first: i, name: r.productTypeName };
    c.n++;
    counts.set(r.productTypeId, c);
  });
  const [id, c] = [...counts.entries()].sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first)[0];
  return { id, name: c.name };
}

const labelFor = (r: Pick<ValidRow, "capacity" | "unit" | "productTypeId" | "productTypeName">, primaryTypeId: string) =>
  r.productTypeId === primaryTypeId ? `${r.capacity} ${r.unit}` : `${r.capacity} ${r.unit} ${r.productTypeName}`;

/**
 * Matches validated rows against existing products and decides, per product,
 * what would be created or changed. Pure: never writes.
 *
 * Product matching (in order): any row SKU already used by a product's variant;
 * else the same web address (slug); else the same name. Contradictions are errors.
 * Variant matching inside an existing product: same SKU; else same size for the
 * product's own type on a variant without a SKU. Existing SKUs are never replaced.
 */
export function planImport(validation: ValidationResult, existing: readonly ExistingProduct[], options: ImportOptions): ImportPlan {
  const issues = [...validation.issues];
  const err = (rowNumber: number, message: string, field?: ImportField) => issues.push({ rowNumber, field, message, kind: "error" });

  const bySlug = new Map(existing.map((e) => [e.product.id, e]));
  const byName = new Map(existing.map((e) => [productKeyOf(normalizeProductName(e.product.name)), e]));
  const skuOwner = new Map<string, { product: ExistingProduct; variant: ExistingProduct["variants"][number] }>();
  for (const e of existing) for (const v of e.variants) if (v.sku) skuOwner.set(v.sku.toUpperCase(), { product: e, variant: v });

  const groups = new Map<string, ValidRow[]>();
  for (const r of validation.valid) groups.set(r.productKey, [...(groups.get(r.productKey) ?? []), r]);

  const products: PlannedProduct[] = [];
  for (const rows of groups.values()) {
    const rowNums = rows.map((r) => r.rowNumber);
    const fail = (message: string, field?: ImportField) => rows.forEach((r) => err(r.rowNumber, message, field));
    const slug = slugify(rows[0].name);

    const skuProducts = new Set(rows.map((r) => skuOwner.get(r.sku)?.product).filter((p): p is ExistingProduct => Boolean(p)));
    if (skuProducts.size > 1) {
      fail(`These SKUs already belong to different products (${[...skuProducts].map((p) => p.product.name).join(", ")})`, "sku");
      continue;
    }
    const bySkuMatch = [...skuProducts][0];
    const byIdentity = bySlug.get(slug) ?? byName.get(rows[0].productKey);
    if (bySkuMatch && byIdentity && bySkuMatch !== byIdentity) {
      fail(`SKU belongs to "${bySkuMatch.product.name}" but the name matches "${byIdentity.product.name}"`, "sku");
      continue;
    }
    const match = bySkuMatch ?? byIdentity;
    const notes = rows.find((r) => r.notes)?.notes ?? null;

    if (!match) {
      const primary = mostCommonType(rows);
      const ordered = [...rows].sort((a, b) => Number(b.productTypeId === primary.id) - Number(a.productTypeId === primary.id) || a.productTypeName.localeCompare(b.productTypeName) || a.capacity - b.capacity);
      products.push({
        action: "create", productId: slug, name: rows[0].name, productTypeId: primary.id, productTypeName: primary.name, category: rows[0].category, notes,
        sizes: [...new Set(ordered.filter((r) => r.productTypeId === primary.id).map((r) => r.capacity))].sort((a, b) => a - b),
        status: options.activateNewProducts ? "ACTIVE" : "INACTIVE", changes: [], rows: rowNums,
        variants: ordered.map((r, i) => ({
          action: "create", variantId: variantIdFromSku(r.sku), rowNumber: r.rowNumber, capacity: r.capacity, unit: r.unit, label: labelFor(r, primary.id),
          priceInr: r.priceInr, stockQuantity: r.stockQuantity, sku: r.sku, sortOrder: i, changes: [],
        })),
      });
      continue;
    }

    // Existing product.
    const p = match.product;
    const primaryTypeId = p.productTypeId ?? "perfume-spray";
    const live = match.variants.filter((v) => v.status !== "ARCHIVED");
    const claimed = new Map<string, number>();
    const planned: PlannedVariant[] = [];
    let conflict = false;
    let nextSort = Math.max(-1, ...live.map((v) => v.sortOrder ?? 0)) + 1;
    const takenIds = new Set(match.variants.map(variantIdOf));

    for (const r of [...rows].sort((a, b) => a.capacity - b.capacity)) {
      const owner = skuOwner.get(r.sku);
      let target: ExistingProduct["variants"][number] | undefined;
      if (owner) {
        if (owner.variant.status === "ARCHIVED") {
          err(r.rowNumber, `SKU ${r.sku} belongs to an archived variant of "${p.name}". Restore or change it in Products first.`, "sku");
          conflict = true;
          continue;
        }
        target = owner.variant;
      } else if (r.productTypeId === primaryTypeId) {
        target = live.find((v) => (v.capacity ?? v.sizeMl) === r.capacity && (v.unit ?? "ml") === r.unit);
        if (target?.sku && target.sku.toUpperCase() !== r.sku) {
          err(r.rowNumber, `"${p.name}" ${r.capacity} ${r.unit} already has SKU ${target.sku}; the file has ${r.sku}. SKUs are never replaced by an import.`, "sku");
          conflict = true;
          continue;
        }
      }
      if (target) {
        const id = variantIdOf(target);
        if (claimed.has(id)) {
          err(r.rowNumber, `Rows ${claimed.get(id)} and ${r.rowNumber} both match the same existing variant of "${p.name}"`);
          conflict = true;
          continue;
        }
        claimed.set(id, r.rowNumber);
        const changes: FieldChange[] = [];
        if (target.priceInr !== r.priceInr) changes.push({ field: "Price", from: fmt(target.priceInr), to: String(r.priceInr) });
        if (target.stockQuantity !== r.stockQuantity) changes.push({ field: "Stock", from: fmt(target.stockQuantity), to: String(r.stockQuantity) });
        if (!target.sku) changes.push({ field: "SKU", from: "not set", to: r.sku });
        planned.push({
          action: changes.length ? "update" : "unchanged", variantId: id, rowNumber: r.rowNumber, existingVersion: target.version,
          capacity: target.capacity ?? target.sizeMl ?? r.capacity, unit: (target.unit ?? "ml") as ProductTypeUnit, label: target.label ?? `${r.capacity} ${r.unit}`,
          priceInr: r.priceInr, stockQuantity: r.stockQuantity, sku: target.sku?.toUpperCase() ?? r.sku, sortOrder: target.sortOrder ?? 0, changes,
        });
      } else {
        let id = variantIdFromSku(r.sku);
        while (takenIds.has(id)) id = `${id.slice(0, 60)}-${takenIds.size}`;
        takenIds.add(id);
        planned.push({
          action: "create", variantId: id, rowNumber: r.rowNumber, capacity: r.capacity, unit: r.unit, label: labelFor(r, primaryTypeId),
          priceInr: r.priceInr, stockQuantity: r.stockQuantity, sku: r.sku, sortOrder: nextSort++,
          changes: [{ field: "Variant", from: "-", to: `new ${labelFor(r, primaryTypeId)}` }],
        });
      }
    }
    planned.sort((a, b) => a.sortOrder - b.sortOrder); // display order: existing sizes, then added ones
    if (conflict) {
      // Hold back the whole product: never apply part of an existing product's rows.
      for (const r of rows) if (!issues.some((i) => i.rowNumber === r.rowNumber && i.kind === "error")) err(r.rowNumber, `Held back: another row of "${p.name}" has a conflict`);
      continue;
    }

    const changes: FieldChange[] = [];
    if (p.category.toLowerCase() !== rows[0].category.toLowerCase()) changes.push({ field: "Category", from: p.category, to: rows[0].category });
    if (notes && notesSignature(notes) !== notesSignature(p.notes ?? null)) changes.push({ field: "Notes", from: fmtNotes(p.notes), to: fmtNotes(notes) });
    const newPrimarySizes = planned.filter((v) => v.action === "create" && rows.find((r) => r.rowNumber === v.rowNumber)!.productTypeId === primaryTypeId).map((v) => v.capacity);
    const existingSizes = (p.sizes ?? []).map(Number).filter((n) => Number.isFinite(n));
    const sizes = [...new Set([...existingSizes, ...newPrimarySizes])].sort((a, b) => a - b);

    const anyChange = changes.length > 0 || planned.some((v) => v.action !== "unchanged");
    products.push({
      action: !anyChange ? "unchanged" : options.updateExisting ? "update" : "skip",
      productId: p.id, name: p.name, existingVersion: p.version, productTypeId: primaryTypeId, productTypeName: p.productTypeName ?? primaryTypeId,
      category: changes.some((c) => c.field === "Category") ? rows[0].category : p.category,
      notes: changes.some((c) => c.field === "Notes") ? notes : (p.notes ?? null),
      sizes: sizes.length ? sizes : existingSizes, status: p.status, changes, rows: rowNums, variants: planned,
    });
  }

  issues.sort((a, b) => a.rowNumber - b.rowNumber || a.kind.localeCompare(b.kind));
  const errorRows = new Set(issues.filter((i) => i.kind === "error").map((i) => i.rowNumber));
  const applied = products.filter((p) => p.action === "create" || p.action === "update");
  const totals: ImportTotals = {
    rows: validation.totalRows,
    newProducts: products.filter((p) => p.action === "create").length,
    newVariants: applied.reduce((n, p) => n + p.variants.filter((v) => v.action === "create").length, 0),
    existingRecordsToUpdate: products.filter((p) => p.action === "update").reduce((n, p) => n + (p.changes.length ? 1 : 0) + p.variants.filter((v) => v.action === "update").length, 0),
    existingProductsAffected: products.filter((p) => p.action === "update").length,
    existingSkipped: products.filter((p) => p.action === "skip").length,
    unchangedRows: products.reduce((n, p) => n + (p.action === "unchanged" ? p.rows.length : p.variants.filter((v) => v.action === "unchanged").length), 0),
    duplicates: issues.filter((i) => i.kind === "duplicate").length,
    invalidRows: errorRows.size,
  };
  return { products, issues, totals, fingerprint: fingerprintOf(products, options) };
}

/* -------------------------------------------------------------- fingerprint --- */

/** Stable hash of exactly what would be written (cyrb53). Changes when the plan or the stored versions change. */
export function fingerprintOf(products: readonly PlannedProduct[], options: ImportOptions): string {
  const s = JSON.stringify({ options, products: products.map((p) => [p.action, p.productId, p.existingVersion, p.category, p.status, notesSignature(p.notes), p.sizes, p.variants.map((v) => [v.action, v.variantId, v.existingVersion, v.priceInr, v.stockQuantity, v.sku, v.label, v.sortOrder])]) });
  let h1 = 0xdeadbeef ^ s.length;
  let h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/* ----------------------------------------------------------- request schema --- */

export const importRequestSchema = z.object({
  rows: z.array(rawImportRowSchema).min(1, "The file has no product rows").max(MAX_IMPORT_ROWS + 1000),
  typeMap: z.record(z.string().max(100), z.string().max(64)),
  titleCaseNames: z.boolean().default(true),
  options: z.object({ updateExisting: z.boolean().default(false), activateNewProducts: z.boolean().default(false) }),
});
export type ImportRequest = z.infer<typeof importRequestSchema>;

export const applyRequestSchema = importRequestSchema.extend({ fingerprint: z.string().min(1).max(64) });
