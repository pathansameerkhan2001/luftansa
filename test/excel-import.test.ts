import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
// Loaded through the "@" alias so it shares one AWS SDK instance with the services under test.
import { InMemoryDynamoClient } from "@/../test/helpers/in-memory-dynamo";
import {
  autoMapColumns, extractRows, findHeaderRow, fingerprintOf, normalizeSku, parseNotes, parseRupees, parseSize, parseStock, planImport, slugify,
  suggestProductType, toTitleCase, typeKey, validateRows, type CellValue, type ExistingProduct, type ImportRequest, type RawImportRow,
} from "@/lib/catalogue/excel-import";
import { applyImport, buildPlan, loadImportContext } from "@/lib/catalogue/excel-import-apply";
import { buildRowsToFixWorkbook, readSpreadsheet } from "@/lib/catalogue/spreadsheet";
import { AuditService } from "@/lib/db/audit";
import { Repository } from "@/lib/db/repository";
import { createProduct, deleteProduct, getProductWithVariants, listAllProductsWithVariants, updateProduct } from "@/lib/db/products-service";
import { seedInitialProductTypes } from "@/lib/db/product-types-service";
import { buildStorefrontCatalogue, toStorefrontOptions } from "@/lib/storefront/products";

console.log("--- Testing Excel product import ---");

const ACTOR = "admin@luftansa.local";
const TYPES = [{ id: "perfume-spray", name: "Perfume Spray" }, { id: "roll-on", name: "Roll-On" }, { id: "attar", name: "Attar" }];
const TYPE_MAP = { spray: "perfume-spray", rollon: "roll-on" };
const HEADER = ["Product Name", "Type (Spray or Roll on)", "Size (ml)", "Price", "Category", "Stock", "SKU", "Notes"];
const NOTES = "Top: Coffee; Pear | Middle: Jasmine | Base: Vanilla; Musk";

/** The four rows the real file has per fragrance (Spray 30/50/100 + Roll-On 8). */
function fragrance(name: string, n: number, opts: { notes?: string | null; price30?: number } = {}): CellValue[][] {
  const code = String(n).padStart(3, "0");
  const notes = opts.notes === undefined ? NOTES : opts.notes;
  return [
    [name, "Spray", "30 ml", opts.price30 ?? 449, "Perfumes", 100, `LFT-${code}-SP-030`, notes],
    [name, "Spray", "50 ml", 749, "Perfumes", 100, `LFT-${code}-SP-050`, notes],
    [name, "Spray", "100 ml", 1299, "Perfumes", 100, `LFT-${code}-SP-100`, notes],
    [name, "Roll-On", "8 ml", 229, "Perfumes", 100, `LFT-${code}-RO-008`, notes],
  ];
}
const sheet = (...rows: CellValue[][][]): CellValue[][] => [HEADER, ...rows.flat()];
const rowsOf = (matrix: CellValue[][]) => extractRows(matrix, autoMapColumns(matrix[findHeaderRow(matrix)]));
const ctx = { typeMap: TYPE_MAP, productTypes: TYPES, titleCaseNames: true };
const OFF = { updateExisting: false, activateNewProducts: false };
const errorsFor = (issues: { rowNumber: number; kind: string; message: string }[], row: number) => issues.filter((i) => i.rowNumber === row && i.kind === "error").map((i) => i.message).join(" | ");

console.log("1. Column matching and row extraction...");
{
  const m = autoMapColumns(HEADER);
  assert.deepEqual(m, { name: 0, type: 1, size: 2, price: 3, category: 4, stock: 5, sku: 6, notes: 7 }, "real headings, incl. 'Type (Spray or Roll on)'");
  assert.deepEqual(autoMapColumns(["SKU", "Qty", "Fragrance", "Rate", "Collection", "Format", "Capacity"]), { sku: 0, stock: 1, name: 2, price: 3, category: 4, type: 5, size: 6 });
  assert.equal(autoMapColumns(["Notes", "Notes"]).notes, 0, "a column is used once");
  const matrix: CellValue[][] = [[], ["Luftansa price list"], HEADER, ...fragrance("STONEWOOD", 1), [null, null, null], ["", " "], ...fragrance("PURPLE SPORT", 2)];
  assert.equal(findHeaderRow(matrix), 2, "title rows above the headings are skipped");
  const rows = rowsOf(matrix);
  assert.equal(rows.length, 8, "blank rows skipped");
  assert.equal(rows[0].rowNumber, 4, "row numbers match Excel (header on row 3)");
  assert.equal(rows[4].rowNumber, 10);
  console.log("   ✓ automatic mapping, header detection, Excel row numbers");
}

console.log("2. Field parsing...");
{
  assert.deepEqual(parseSize("30 ml"), { capacity: 30, unit: "ml" });
  assert.deepEqual(parseSize("8ML"), { capacity: 8, unit: "ml" });
  assert.deepEqual(parseSize(100), { capacity: 100, unit: "ml" }, "number in a 'Size (ml)' column");
  assert.deepEqual(parseSize("12 g"), { capacity: 12, unit: "g" });
  for (const bad of ["", "large", "30 litres", "-5 ml", "0", "20000 ml"]) assert.equal(parseSize(bad), null, `size ${bad}`);
  assert.equal(parseRupees("₹1,299"), 1299);
  assert.equal(parseRupees("1299.00"), 1299);
  assert.equal(parseRupees(449), 449);
  for (const bad of [449.5, "449.50", "0", "-1", "abc", ""]) assert.equal(parseRupees(bad), null, `price ${bad}`);
  assert.equal(parseStock(0), 0);
  assert.equal(parseStock("1,000"), 1000);
  for (const bad of [-1, 2.5, "lots", ""]) assert.equal(parseStock(bad), null, `stock ${bad}`);
  assert.equal(normalizeSku(" lft-001-sp-030 "), "LFT-001-SP-030");
  for (const bad of ["", "LFT 001", "-LFT", "x".repeat(65), "LFT/001"]) assert.equal(normalizeSku(bad), null, `sku ${bad}`);
  assert.equal(toTitleCase("BLACK VELVET"), "Black Velvet");
  assert.equal(toTitleCase("LUFTANSA CK"), "Luftansa CK", "short all-caps words kept");
  assert.equal(toTitleCase("Déjà Vu"), "Déjà Vu", "mixed case untouched");
  assert.equal(slugify("Ambery Nights & Oud"), "ambery-nights-and-oud");
  assert.equal(slugify("Déjà Vu"), "deja-vu");
  assert.equal(typeKey("Roll-On"), typeKey("roll on"));
  assert.equal(suggestProductType("Spray", TYPES), "perfume-spray");
  assert.equal(suggestProductType("Roll on", TYPES), "roll-on");
  assert.equal(suggestProductType("Diffuser", TYPES), undefined);
  const n = parseNotes("Top: Bergamot; Artemisia | Middle: Iris, Tobacco | Base: Amber");
  assert.deepEqual(n.notes?.top.map((x) => x.name), ["Bergamot", "Artemisia"]);
  assert.deepEqual(n.notes?.heart.map((x) => x.name), ["Iris", "Tobacco"], "Middle → heart notes");
  assert.equal(parseNotes("").notes, null);
  assert.ok(parseNotes("Bergamot and amber").error);
  assert.equal(parseNotes(`Base: ${Array.from({ length: 11 }, (_, i) => `Note${i}`).join("; ")}`).notes?.base.length, 11, "11 notes in a group (Afghan Tiger)");
  assert.equal(parseNotes(`Base: ${Array.from({ length: 12 }, (_, i) => `Note${i}`).join("; ")}`).notes?.base.length, 12, "12 notes in a group");
  assert.match(parseNotes(`Base: ${Array.from({ length: 13 }, (_, i) => `Note${i}`).join("; ")}`).error ?? "", /At most 12 notes per group/, "more than 12 notes in a group");
  console.log("   ✓ sizes, rupees, stock, SKU, names, slugs, types, notes");
}

console.log("3. Row validation with row-specific messages...");
{
  const bad: CellValue[][] = [
    ["", "Spray", "30 ml", 449, "Perfumes", 100, "A-1", null],
    ["Bad Type", "Diffuser", "30 ml", 449, "Perfumes", 100, "A-2", null],
    ["Bad Size", "Spray", "big", 449, "Perfumes", 100, "A-3", null],
    ["Bad Price", "Spray", "30 ml", "free", "Perfumes", 100, "A-4", null],
    ["No Category", "Spray", "30 ml", 449, "", 100, "A-5", null],
    ["Bad Stock", "Spray", "30 ml", 449, "Perfumes", -3, "A-6", null],
    ["No Sku", "Spray", "30 ml", 449, "Perfumes", 100, "", null],
    ["Bad Notes", "Spray", "30 ml", 449, "Perfumes", 100, "A-8", "smells great"],
    ["Good", "Spray", "30 ml", 449, "Perfumes", 100, "A-9", null],
  ];
  const v = validateRows(rowsOf(sheet(bad)), ctx);
  assert.match(errorsFor(v.issues, 2), /Product name is missing/);
  assert.match(errorsFor(v.issues, 3), /Type "Diffuser" is not matched/);
  assert.match(errorsFor(v.issues, 4), /Size "big"/);
  assert.match(errorsFor(v.issues, 5), /Price "free" must be a whole rupee amount/);
  assert.match(errorsFor(v.issues, 6), /Category is missing/);
  assert.match(errorsFor(v.issues, 7), /Stock "-3"/);
  assert.match(errorsFor(v.issues, 8), /SKU is missing/);
  assert.match(errorsFor(v.issues, 9), /Write notes as/);
  assert.deepEqual(v.valid.map((r) => r.rowNumber), [10], "only the good row is valid");
  assert.equal(v.issues.find((i) => i.rowNumber === 5)?.field, "price", "issues name the field");
  console.log("   ✓ every required field validated; messages name the row and field");
}

console.log("4. Duplicates and conflicts...");
{
  const base = fragrance("STONEWOOD", 1);
  const v = validateRows(rowsOf(sheet(base, [base[0]])), ctx);
  assert.deepEqual(v.issues.map((i) => [i.rowNumber, i.kind]), [[6, "duplicate"]], "identical repeat → duplicate, skipped");
  assert.equal(v.valid.length, 4);

  const changed = [...base[0]];
  changed[3] = 499;
  const c = validateRows(rowsOf(sheet(base, [changed])), ctx);
  assert.match(errorsFor(c.issues, 2), /Rows 2, 6 are the same product, type and size with different values/);
  assert.equal(c.valid.length, 1, "the Perfume is held back; its Roll-On is a separate product and stays valid");
  assert.equal(c.valid[0].productTypeId, "roll-on");
  assert.match(errorsFor(c.issues, 3), /Held back: row 2/);

  const other = fragrance("PURPLE SPORT", 2);
  other[0][6] = "LFT-001-SP-030";
  const s = validateRows(rowsOf(sheet(base, other)), ctx);
  assert.match(errorsFor(s.issues, 2), /SKU LFT-001-SP-030 is used on rows 2, 6 for different variants/);
  assert.match(errorsFor(s.issues, 6), /SKU LFT-001-SP-030/);

  const cat = fragrance("STONEWOOD", 1);
  cat[2][4] = "Attars"; // Spray 100 ml differs from the other Spray rows
  assert.match(errorsFor(validateRows(rowsOf(sheet(cat)), ctx).issues, 2), /Category differs between rows 2, 3, 4/);
  const rollOnCategory = fragrance("STONEWOOD", 1);
  rollOnCategory[3][4] = "Roll-Ons";
  assert.equal(validateRows(rowsOf(sheet(rollOnCategory)), ctx).issues.length, 0, "a Roll-On may have its own category (separate product)");

  const notes = fragrance("STONEWOOD", 1);
  notes[2][7] = "Top: Rose";
  assert.match(errorsFor(validateRows(rowsOf(sheet(notes)), ctx).issues, 4), /Notes differ/);
  const blankNotes = fragrance("STONEWOOD", 1);
  blankNotes[1][7] = null;
  assert.equal(validateRows(rowsOf(sheet(blankNotes)), ctx).issues.length, 0, "a blank Notes cell is not a conflict");

  const clash = validateRows(rowsOf(sheet(fragrance("Oud-Forest", 3), fragrance("Oud Forest", 4))), { ...ctx, titleCaseNames: false });
  assert.match(errorsFor(clash.issues, 6), /same web address "oud-forest"/);

  const both = validateRows(rowsOf(sheet(fragrance("BLACK VELVET", 4))), ctx);
  assert.equal(both.issues.length, 0, "the same name as Spray and Roll-On is not a clash: two products");

  const afghan = validateRows(rowsOf(sheet(fragrance("AFGHAN TIGER", 5, { notes: `Base: ${Array.from({ length: 11 }, (_, i) => `N${i}`).join("; ")}` }))), ctx);
  assert.deepEqual([afghan.valid.length, afghan.issues.length], [4, 0], "11 Base notes (Afghan Tiger) are accepted");
  const tooMany = fragrance("TOO MANY", 6, { notes: `Base: ${Array.from({ length: 13 }, (_, i) => `N${i}`).join("; ")}` });
  const t = validateRows(rowsOf(sheet(tooMany)), ctx);
  assert.equal(t.valid.length, 0);
  assert.equal(new Set(t.issues.map((i) => i.rowNumber)).size, 4, "all four rows of the product reported");
  console.log("   ✓ duplicates skipped; conflicting rows, shared SKUs, category/notes clashes and similar names rejected");
}

console.log("5. Perfumes and Roll-Ons become separate products...");
{
  const v = validateRows(rowsOf(sheet(fragrance("BLACK VELVET", 4), fragrance("STONEWOOD", 1, { notes: null }))), ctx);
  const plan = planImport(v, [], OFF);
  assert.deepEqual(plan.products.map((p) => [p.productId, p.productTypeId, p.variants.length]), [
    ["black-velvet", "perfume-spray", 3],
    ["black-velvet-roll-on", "roll-on", 1],
    ["stonewood", "perfume-spray", 3],
    ["stonewood-roll-on", "roll-on", 1],
  ], "one product per name and type; never one per row");
  const bv = plan.products.find((p) => p.productId === "black-velvet")!;
  assert.equal(bv.action, "create");
  assert.equal(bv.name, "Black Velvet");
  assert.equal(bv.productTypeName, "Perfume Spray");
  assert.equal(bv.status, "INACTIVE", "new products are Hidden unless chosen otherwise");
  assert.deepEqual(bv.sizes, [30, 50, 100]);
  assert.deepEqual(bv.variants.map((x) => [x.label, x.priceInr, x.stockQuantity, x.sku, x.sortOrder]), [
    ["30 ml", 449, 100, "LFT-004-SP-030", 0],
    ["50 ml", 749, 100, "LFT-004-SP-050", 1],
    ["100 ml", 1299, 100, "LFT-004-SP-100", 2],
  ], "Perfume: spray sizes only");
  assert.ok(!bv.variants.some((x) => x.sku.includes("-RO-")), "a Roll-On is never a size of the Perfume");
  const ro = plan.products.find((p) => p.productId === "black-velvet-roll-on")!;
  assert.equal(ro.name, "Black Velvet", "same fragrance name; the storefront shows it as 'Black Velvet Roll-On'");
  assert.equal(ro.productTypeName, "Roll-On");
  assert.equal(ro.category, "Roll-On", "a Roll-On listed under 'Perfumes' is categorised Roll-On");
  assert.equal(bv.category, "Perfumes", "Perfumes keep their category");
  assert.deepEqual(ro.sizes, [8]);
  assert.deepEqual(ro.variants.map((x) => [x.label, x.priceInr, x.stockQuantity, x.sku, x.variantId]), [["8 ml", 229, 100, "LFT-004-RO-008", "v_lft-004-ro-008"]]);
  assert.deepEqual(ro.notes?.base.map((n) => n.name), ["Vanilla", "Musk"], "notes carried by the Roll-On too");
  assert.equal(bv.variants[0].variantId, "v_lft-004-sp-030", "stable variant id from the SKU");
  assert.equal(plan.products.find((p) => p.productId === "stonewood")!.notes, null);
  assert.deepEqual(
    { newProducts: plan.totals.newProducts, newVariants: plan.totals.newVariants, rows: plan.totals.rows, invalid: plan.totals.invalidRows },
    { newProducts: 4, newVariants: 8, rows: 8, invalid: 0 },
  );
  assert.equal(planImport(v, [], { updateExisting: false, activateNewProducts: true }).products[0].status, "ACTIVE");
  const rollOnOnly = planImport(validateRows(rowsOf(sheet([["Mini", "Roll-On", "8 ml", 229, "Perfumes", 5, "MINI-RO", null]])), ctx), [], OFF);
  assert.deepEqual([rollOnOnly.products[0].productId, rollOnOnly.products[0].productTypeId, rollOnOnly.products[0].variants[0].label], ["mini-roll-on", "roll-on", "8 ml"]);
  console.log("   ✓ Spray rows → Perfume (30/50/100 ml); Roll-On rows → separate Roll-On product (8 ml); own web address and SKU");
}

/** An existing product shaped like today's local catalogue (spray 30/50/100, no SKUs, standard prices). */
function existingProduct(id: string, name: string, extra: Partial<ExistingProduct["variants"][number]>[] = []): ExistingProduct {
  return {
    product: { id, name, version: 3, productTypeId: "perfume-spray", productTypeName: "Perfume Spray", category: "Perfume", notes: { top: [], heart: [], base: [] }, sizes: [30, 50, 100], status: "ACTIVE" },
    variants: [30, 50, 100].map((c, i) => ({ id: `${c}ml`, sk: `VARIANT#${c}ml`, capacity: c, unit: "ml" as const, label: `${c} ml`, priceInr: { 30: 400, 50: 630, 100: 1000 }[c]!, status: "ACTIVE" as const, sortOrder: i, version: 1, ...extra[i] })),
  };
}

/** An existing Roll-On product (separate record), optionally with SKU. */
function existingRollOn(id: string, name: string, sku?: string): ExistingProduct {
  return {
    product: { id, name, version: 2, productTypeId: "roll-on", productTypeName: "Roll-On", category: "Perfumes", notes: { top: [], heart: [], base: [] }, sizes: [8], status: "ACTIVE" },
    variants: [{ id: "8ml", sk: "VARIANT#8ml", capacity: 8, unit: "ml", label: "8 ml", priceInr: 199, status: "ACTIVE", sortOrder: 0, version: 1, ...(sku ? { sku } : {}) }],
  };
}

console.log("6. Matching existing products safely (always within the same type)...");
{
  const file = validateRows(rowsOf(sheet(fragrance("BLACK VELVET", 4))), ctx);
  const existing = [existingProduct("black-velvet", "Black Velvet")];
  const skip = planImport(file, existing, OFF);
  assert.deepEqual(skip.products.map((p) => [p.productId, p.action]), [["black-velvet", "skip"], ["black-velvet-roll-on", "create"]], "existing Perfume not changed; Roll-On is a new separate product");
  assert.equal(skip.totals.existingSkipped, 1);
  assert.deepEqual([skip.totals.newProducts, skip.totals.newVariants, skip.totals.existingRecordsToUpdate], [1, 1, 0]);

  const upd = planImport(file, existing, { ...OFF, updateExisting: true });
  const p = upd.products[0];
  assert.equal(p.action, "update");
  assert.deepEqual(p.changes.map((c) => c.field), ["Category", "Notes"]);
  assert.deepEqual(p.variants.map((v) => [v.variantId, v.action]), [["30ml", "update"], ["50ml", "update"], ["100ml", "update"]], "no Roll-On added to the Perfume");
  assert.deepEqual(p.variants[0].changes, [{ field: "Price", from: "400", to: "449" }, { field: "Stock", from: "not set", to: "100" }, { field: "SKU", from: "not set", to: "LFT-004-SP-030" }]);
  assert.deepEqual(p.sizes, [30, 50, 100]);
  assert.deepEqual([upd.totals.newProducts, upd.totals.newVariants, upd.totals.existingRecordsToUpdate, upd.totals.existingProductsAffected], [1, 1, 4, 1]);

  // An existing Roll-On is matched by SKU (or web address) and updated on its own; the Perfume is untouched by it.
  const withRollOn = planImport(file, [existingProduct("black-velvet", "Black Velvet"), existingRollOn("black-velvet-roll-on", "Black Velvet", "LFT-004-RO-008")], { ...OFF, updateExisting: true });
  const ro = withRollOn.products.find((x) => x.productTypeId === "roll-on")!;
  assert.deepEqual([ro.productId, ro.action, ro.variants[0].variantId, ro.variants[0].changes.map((c) => c.field).join("+")], ["black-velvet-roll-on", "update", "8ml", "Price+Stock"]);

  // Name matching never crosses types: a Roll-On called "Black Velvet" is not the Perfume.
  const rollOnByName = planImport(file, [existingRollOn("bv-mini", "Black Velvet")], { ...OFF, updateExisting: true });
  assert.deepEqual(rollOnByName.products.map((x) => [x.productId, x.action]), [["black-velvet", "create"], ["bv-mini", "update"]]);

  // A Roll-On SKU stored as a size of the Perfume (old structure) is reported, never overwritten.
  const legacy = existingProduct("black-velvet", "Black Velvet");
  legacy.variants.push({ id: "v_lft-004-ro-008", sk: "VARIANT#v_lft-004-ro-008", capacity: 8, unit: "ml", label: "8 ml Roll-On", priceInr: 229, status: "ACTIVE", sortOrder: 3, version: 1, sku: "LFT-004-RO-008" });
  const legacyPlan = planImport(file, [legacy], { ...OFF, updateExisting: true });
  assert.match(errorsFor(legacyPlan.issues, 5), /SKU LFT-004-RO-008 belongs to the Perfume product "Black Velvet", but this row is a Roll-On/);
  assert.ok(!legacyPlan.products.some((x) => x.productTypeId === "roll-on"), "no Roll-On planned while its SKU sits inside the Perfume");
  assert.equal(legacyPlan.products[0].productId, "black-velvet", "the Perfume rows are still handled normally");

  // A web address used by a product of another type is reported.
  const taken = existingProduct("black-velvet-roll-on", "Something Else");
  assert.match(errorsFor(planImport(file, [taken], OFF).issues, 5), /web address "black-velvet-roll-on" is already used by the Perfume product "Something Else"/);

  // Matched by name when the web address differs.
  const byName = planImport(file, [existingProduct("bv-classic", "Black Velvet")], { ...OFF, updateExisting: true });
  assert.equal(byName.products[0].productId, "bv-classic");

  // Matched by SKU even when the name differs; renamed products keep their name.
  const withSkus = existingProduct("velvet-noir", "Velvet Noir", [{ sku: "LFT-004-SP-030" }, { sku: "LFT-004-SP-050" }, { sku: "LFT-004-SP-100" }]);
  const bySku = planImport(file, [withSkus], { ...OFF, updateExisting: true });
  assert.equal(bySku.products[0].productId, "velvet-noir");
  assert.equal(bySku.products[0].name, "Velvet Noir");

  // SKU on one product, name on another → conflict; only the Roll-On (unaffected) is planned.
  const contradiction = planImport(file, [withSkus, existingProduct("black-velvet", "Black Velvet")], { ...OFF, updateExisting: true });
  assert.deepEqual(contradiction.products.map((x) => x.productId), ["black-velvet-roll-on"]);
  assert.match(errorsFor(contradiction.issues, 2), /SKU belongs to "Velvet Noir" but the name matches "Black Velvet"/);

  // Existing SKUs are never replaced.
  const otherSku = existingProduct("black-velvet", "Black Velvet", [{ sku: "OLD-30" }]);
  const replace = planImport(file, [otherSku], { ...OFF, updateExisting: true });
  assert.match(errorsFor(replace.issues, 2), /already has SKU OLD-30; the file has LFT-004-SP-030/);
  assert.match(errorsFor(replace.issues, 3), /Held back/);
  assert.deepEqual(replace.products.map((x) => x.productId), ["black-velvet-roll-on"], "the whole Perfume is held back");

  // A SKU on an archived variant is not silently revived.
  const archived = existingProduct("black-velvet", "Black Velvet", [{ sku: "LFT-004-SP-030", status: "ARCHIVED" }]);
  assert.match(errorsFor(planImport(file, [archived], { ...OFF, updateExisting: true }).issues, 2), /archived variant/);

  // Same values → unchanged.
  const same = existingProduct("stonewood", "Stonewood", [{ priceInr: 449, stockQuantity: 100, sku: "LFT-001-SP-030" }, { priceInr: 749, stockQuantity: 100, sku: "LFT-001-SP-050" }, { priceInr: 1299, stockQuantity: 100, sku: "LFT-001-SP-100" }]);
  same.product.category = "Perfumes";
  const sameFile = validateRows(rowsOf(sheet(fragrance("STONEWOOD", 1, { notes: null }).slice(0, 3))), ctx);
  const u = planImport(sameFile, [same], { ...OFF, updateExisting: true });
  assert.equal(u.products[0].action, "unchanged");
  assert.equal(u.totals.unchangedRows, 3);
  console.log("   ✓ SKU → web address → name matching within the same type; cross-type SKUs and addresses refused; updates opt-in");
}

console.log("7. Fingerprint (what the admin confirmed)...");
{
  const file = validateRows(rowsOf(sheet(fragrance("BLACK VELVET", 4))), ctx);
  const a = planImport(file, [existingProduct("black-velvet", "Black Velvet")], { ...OFF, updateExisting: true });
  assert.equal(a.fingerprint, planImport(file, [existingProduct("black-velvet", "Black Velvet")], { ...OFF, updateExisting: true }).fingerprint, "stable");
  const edited = existingProduct("black-velvet", "Black Velvet");
  edited.product.version = 4;
  assert.notEqual(a.fingerprint, planImport(file, [edited], { ...OFF, updateExisting: true }).fingerprint, "changes when the product was edited");
  assert.notEqual(a.fingerprint, fingerprintOf(a.products, { ...OFF, updateExisting: true, activateNewProducts: true }), "changes with the options");
  console.log("   ✓ fingerprint changes with versions, values and options");
}

console.log("8. Reading .xlsx and .xls files; rows-to-fix download...");
{
  const aoa = [["Luftansa products"], HEADER, ...fragrance("STONEWOOD", 1)];
  for (const bookType of ["xlsx", "xls"] as const) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Products");
    const data = XLSX.write(wb, { type: "array", bookType }) as ArrayBuffer;
    const sheets = readSpreadsheet(data);
    assert.equal(sheets[0].name, "Products");
    const rows = rowsOf(sheets[0].matrix);
    assert.equal(rows.length, 4, `${bookType}: four rows`);
    assert.equal(rows[0].rowNumber, 3, `${bookType}: Excel row numbers`);
    assert.equal(rows[0].values.price, 449);
    assert.equal(validateRows(rows, ctx).valid.length, 4, `${bookType}: rows valid`);
  }
  // Used range starting below row 1 keeps row numbers.
  const ws = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.sheet_add_aoa(ws, [HEADER, ...fragrance("STONEWOOD", 1)], { origin: "A5" });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "S");
  assert.equal(rowsOf(readSpreadsheet(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer)[0].matrix)[0].rowNumber, 6);
  assert.throws(() => readSpreadsheet(new TextEncoder().encode("%PDF-1.7 not a spreadsheet")), /not an Excel workbook/);
  assert.throws(() => readSpreadsheet(new TextEncoder().encode("Product Name,Price\nA,1")), /not an Excel workbook/, "CSV renamed to .xlsx refused");

  const out = buildRowsToFixWorkbook(HEADER, [{ rowNumber: 7, cells: ["X", "Spray", "big", 1, "P", 1, "S", null], problems: "Size: Size \"big\" is not a size" }]);
  const back = XLSX.utils.sheet_to_json<CellValue[]>(XLSX.read(out, { type: "array" }).Sheets["Rows to fix"], { header: 1 });
  assert.deepEqual(back[0], ["Row in original file", ...HEADER, "Problems"]);
  assert.equal(back[1][0], 7);
  assert.match(String(back[1][back[0].length - 1]), /not a size/);
  console.log("   ✓ .xlsx and .xls read; row numbers kept; unreadable files refused; rows-to-fix workbook");
}

/* ------------------------------------------------------- apply (database) --- */

async function setup() {
  const client = new InMemoryDynamoClient();
  const repo = new Repository(client as unknown as DynamoDBDocumentClient, "luftansa-test");
  const audit = new AuditService(repo);
  await seedInitialProductTypes(repo);
  return { client, repo, audit };
}
const request = (matrix: CellValue[][], options = OFF): ImportRequest => ({ rows: rowsOf(matrix) as RawImportRow[], typeMap: TYPE_MAP, titleCaseNames: true, options });
async function confirmAndApply(repo: Repository, audit: AuditService, req: ImportRequest) {
  const plan = buildPlan(req, await loadImportContext(repo));
  return applyImport(repo, audit, ACTOR, req, plan.fingerprint);
}

console.log("9. Applying an import (new products, storefront compatibility)...");
await (async () => {
  const { repo, audit } = await setup();
  const req = request(sheet(fragrance("BLACK VELVET", 4), fragrance("STONEWOOD", 1)), { ...OFF, activateNewProducts: true });
  const result = await confirmAndApply(repo, audit, req);
  assert.equal(result.status, "completed");
  assert.deepEqual(result.applied.map((a) => [a.productId, a.action, a.variantsCreated]), [
    ["black-velvet", "created", 3],
    ["black-velvet-roll-on", "created", 1],
    ["stonewood", "created", 3],
    ["stonewood-roll-on", "created", 1],
  ]);
  const bv = (await getProductWithVariants(repo, "black-velvet"))!;
  assert.equal(bv.product.name, "Black Velvet");
  assert.equal(bv.product.category, "Perfumes");
  assert.equal(bv.product.productTypeId, "perfume-spray");
  assert.equal(bv.product.productTypeName, "Perfume Spray");
  assert.deepEqual(bv.product.notes.top.map((n) => n.name), ["Coffee", "Pear"]);
  assert.equal(bv.variants.length, 3);
  const ro = (await getProductWithVariants(repo, "black-velvet-roll-on"))!;
  assert.deepEqual([ro.product.name, ro.product.productTypeId, ro.product.productTypeName, ro.product.category, ro.variants.length, ro.variants[0].sku], ["Black Velvet", "roll-on", "Roll-On", "Roll-On", 1, "LFT-004-RO-008"]);

  const shop = buildStorefrontCatalogue(await listAllProductsWithVariants(repo));
  const item = shop.find((p) => p.slug === "black-velvet")!;
  assert.ok(item, "visible on the storefront when activated");
  const options = toStorefrontOptions(bv.variants);
  assert.deepEqual(options.map((o) => [o.label, o.priceInr, o.stockQuantity]), [["30 ml", 449, 100], ["50 ml", 749, 100], ["100 ml", 1299, 100]], "Perfume size selector: sprays only");
  const roItem = shop.find((p) => p.slug === "black-velvet-roll-on")!;
  assert.deepEqual([roItem.format, roItem.displayName, item.format, item.displayName], ["roll-on", "Black Velvet Roll-On", "perfume", "Black Velvet"], "storefront sections and names");
  assert.deepEqual(roItem.options.map((o) => [o.label, o.priceInr, o.stockQuantity]), [["8 ml", 229, 100]]);

  const again = await confirmAndApply(repo, audit, req);
  assert.equal(again.status, "nothing_to_import", "importing the same file twice changes nothing");

  // Existing product tools keep working on imported products.
  await updateProduct(repo, audit, ACTOR, "stonewood", { version: (await getProductWithVariants(repo, "stonewood"))!.product.version, status: "INACTIVE" });
  await deleteProduct(repo, audit, ACTOR, "stonewood");
  assert.equal(await getProductWithVariants(repo, "stonewood"), null);

  const hidden = await setup();
  await confirmAndApply(hidden.repo, hidden.audit, request(sheet(fragrance("BLACK VELVET", 4))));
  assert.equal(buildStorefrontCatalogue(await listAllProductsWithVariants(hidden.repo)).length, 0, "Hidden by default: not on the storefront");
  console.log("   ✓ products + variants stored; storefront options, prices, stock; re-import is a no-op; edit/delete still work");
})();

console.log("10. Updating existing products only when confirmed...");
await (async () => {
  const { repo, audit } = await setup();
  await createProduct(repo, audit, ACTOR, { id: "black-velvet", name: "Black Velvet", category: "Perfume", sizes: [30, 50, 100] });
  const before = (await getProductWithVariants(repo, "black-velvet"))!;
  const off = await confirmAndApply(repo, audit, request(sheet(fragrance("BLACK VELVET", 4))));
  assert.deepEqual(off.applied.map((a) => [a.productId, a.action]), [["black-velvet-roll-on", "created"]], "updates off: only the new Roll-On is created");
  assert.deepEqual(await getProductWithVariants(repo, "black-velvet"), before, "existing Perfume untouched");

  const on = await confirmAndApply(repo, audit, request(sheet(fragrance("BLACK VELVET", 4)), { ...OFF, updateExisting: true }));
  assert.equal(on.status, "completed");
  const after = (await getProductWithVariants(repo, "black-velvet"))!;
  assert.equal(after.product.name, "Black Velvet", "name kept");
  assert.equal(after.product.status, "ACTIVE", "status kept");
  assert.equal(after.product.category, "Perfumes");
  const byLabel = Object.fromEntries(after.variants.map((v) => [v.label, v]));
  assert.equal(byLabel["30 ml"].priceInr, 449);
  assert.equal(byLabel["30 ml"].sku, "LFT-004-SP-030");
  assert.equal(byLabel["30 ml"].id, before.variants.find((v) => v.capacity === 30)!.id, "existing variant updated in place (same id)");
  assert.deepEqual(after.variants.map((v) => v.capacity).sort((a, b) => a! - b!), [30, 50, 100], "no Roll-On inside the Perfume");
  assert.equal(after.variants.filter((v) => v.status === "ARCHIVED").length, 0, "no variant archived");
  const ro = (await getProductWithVariants(repo, "black-velvet-roll-on"))!;
  assert.deepEqual([ro.product.productTypeId, ro.variants.length, ro.variants[0].priceInr], ["roll-on", 1, 229], "Roll-On is its own product");
  console.log("   ✓ existing product updated in place only with the option; nothing archived");
})();

console.log("11. Safeguards: changed since review, failure and rollback...");
await (async () => {
  // Changed between review and confirm → refused, nothing written.
  const { repo, audit } = await setup();
  await createProduct(repo, audit, ACTOR, { id: "black-velvet", name: "Black Velvet", category: "Perfume", sizes: [30, 50, 100] });
  const req = request(sheet(fragrance("BLACK VELVET", 4), fragrance("STONEWOOD", 1)), { ...OFF, updateExisting: true });
  const reviewed = buildPlan(req, await loadImportContext(repo));
  const bv = (await getProductWithVariants(repo, "black-velvet"))!;
  await updateProduct(repo, audit, ACTOR, "black-velvet", { version: bv.product.version, description: "edited by someone else" });
  const stale = await applyImport(repo, audit, ACTOR, req, reviewed.fingerprint);
  assert.equal(stale.status, "changed_since_preview");
  assert.equal(await getProductWithVariants(repo, "stonewood"), null, "nothing created");

  // Failure on the third product → the two already saved are undone exactly.
  const t = await setup();
  await createProduct(t.repo, t.audit, ACTOR, { id: "black-velvet", name: "Black Velvet", category: "Perfume", sizes: [30, 50, 100] });
  const original = (await getProductWithVariants(t.repo, "black-velvet"))!;
  const req2 = request(sheet(fragrance("STONEWOOD", 1), fragrance("BLACK VELVET", 4), fragrance("PURPLE SPORT", 2)), { ...OFF, updateExisting: true });
  const plan2 = buildPlan(req2, await loadImportContext(t.repo));
  assert.deepEqual(plan2.products.map((p) => [p.productId, p.action]), [
    ["stonewood", "create"],
    ["stonewood-roll-on", "create"],
    ["black-velvet", "update"],
    ["black-velvet-roll-on", "create"],
    ["purple-sport", "create"],
    ["purple-sport-roll-on", "create"],
  ]);
  const send = t.client.send.bind(t.client);
  let transactions = 0;
  (t.client as unknown as { send: typeof send }).send = async (command) => {
    if (command.constructor.name === "TransactWriteCommand" && ++transactions === 5) throw Object.assign(new Error("Simulated outage"), { name: "InternalServerError" });
    return send(command);
  };
  const failed = await applyImport(t.repo, t.audit, ACTOR, req2, plan2.fingerprint);
  (t.client as unknown as { send: typeof send }).send = send;
  assert.equal(failed.status, "rolled_back");
  assert.equal(failed.failure?.productId, "purple-sport");
  assert.equal(failed.failure?.message, "The database rejected the change.", "no technical error text for the admin");
  assert.deepEqual(failed.rollbackProblems, []);
  for (const id of ["stonewood", "stonewood-roll-on", "black-velvet-roll-on"]) assert.equal(await getProductWithVariants(t.repo, id), null, `created product ${id} removed`);
  assert.equal(await getProductWithVariants(t.repo, "purple-sport"), null, "failed product never written");
  const restored = (await getProductWithVariants(t.repo, "black-velvet"))!;
  const strip = (x: Record<string, unknown>) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== "version" && k !== "updatedAt"));
  assert.deepEqual(strip(restored.product), strip(original.product), "updated product restored to its previous values");
  assert.deepEqual(restored.variants.map(strip).sort((a, b) => String(a.sk).localeCompare(String(b.sk))), original.variants.map(strip).sort((a, b) => String(a.sk).localeCompare(String(b.sk))), "variants restored exactly");
  assert.ok(restored.product.version > original.product.version, "versions keep increasing (no silent overwrite of later edits)");
  console.log("   ✓ stale review refused; mid-import failure rolled back exactly; friendly failure message");
})();

console.log("--- Excel import tests passed ---");
