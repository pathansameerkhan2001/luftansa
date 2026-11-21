"use client";

/**
 * Admin: import products from an Excel file (.xlsx / .xls).
 *
 * Steps: 1 Upload → 2 Match columns → 3 Review (nothing written yet) → 4 Result.
 * The file is read in this browser; the server receives only the rows, checks
 * them again and writes only after the admin confirms the reviewed totals.
 */
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, Columns3, Download, FileSpreadsheet, ListChecks, PackagePlus, RotateCcw, Tags, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  autoMapColumns, extractRows, findHeaderRow, IMPORT_FIELD_LABELS, IMPORT_FIELDS, REQUIRED_IMPORT_FIELDS, suggestProductType, toTitleCase, typeKey,
  type CellValue, type ColumnMapping, type ImportField, type ImportOptions, type ImportPlan, type PlannedProduct,
} from "@/lib/catalogue/excel-import";
import type { ImportResult } from "@/lib/catalogue/excel-import-apply";
import type { SheetData } from "@/lib/catalogue/spreadsheet";
import { Card } from "@/components/admin/cms/FormFields";
import { ADMIN_FOCUS, BTN_PRIMARY, BTN_SECONDARY, ConfirmDialog, FeedbackBanner, FilterTabs, INPUT, PageIntro, Spinner, StatusBadge, useFeedback } from "@/components/admin/cms/ui";

type Step = "upload" | "map" | "review" | "done";
type ProductType = { id: string; name: string; status?: string };

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Upload file" },
  { id: "map", label: "Match columns" },
  { id: "review", label: "Review" },
  { id: "done", label: "Result" },
];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const colName = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const cellText = (c: CellValue | undefined) => (c === null || c === undefined ? "" : String(c));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

async function postJson<T>(url: string, body: unknown): Promise<{ status: number; data: T & { message?: string } }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (res.status === 401) throw new Error("Your session has expired. Please sign in again.");
  return { status: res.status, data };
}

function Stepper({ step }: { step: Step }) {
  const current = STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Import steps">
      {STEPS.map((s, i) => (
        <li key={s.id} aria-current={i === current ? "step" : undefined} className="min-w-0">
          <div className={`h-1 rounded-full ${i <= current ? "bg-brand-gold" : "bg-[#e9e0cd]"}`} />
          <p className={`mt-2 truncate text-[12px] font-semibold tracking-wide ${i === current ? "text-brand-black" : "text-brand-text/50"}`}>
            <span className="mr-1 tabular-nums">{i + 1}.</span>
            {s.label}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Tile({ label, value, tone = "neutral", hint }: { label: string; value: number; tone?: "neutral" | "success" | "warning" | "danger"; hint?: string }) {
  const tones = { neutral: "text-brand-black", success: "text-[#2f5f2a]", warning: "text-[#7a5a2b]", danger: "text-[#8a2f22]" };
  return (
    <div className="rounded-xl border border-[#e3d6bd] bg-[#fffdf8] px-4 py-3" data-total={label}>
      <p className="text-[12px] font-medium text-brand-text/65">{label}</p>
      <p className={`mt-0.5 font-serif text-[28px] leading-none font-semibold tabular-nums ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11.5px] text-brand-text/55">{hint}</p> : null}
    </div>
  );
}

const ACTION_BADGE: Record<PlannedProduct["action"], { tone: "success" | "warning" | "neutral" | "dark"; label: string }> = {
  create: { tone: "success", label: "New" },
  update: { tone: "warning", label: "Will be updated" },
  skip: { tone: "dark", label: "Exists · not updated" },
  unchanged: { tone: "neutral", label: "Already up to date" },
};

function ProductRow({ p }: { p: PlannedProduct }) {
  const [open, setOpen] = useState(false);
  const badge = ACTION_BADGE[p.action];
  const changedVariants = p.variants.filter((v) => v.action !== "unchanged").length;
  return (
    <li className="border-b border-[#efe6d4] last:border-0" data-plan-product={p.productId} data-plan-action={p.action}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`flex w-full items-center gap-3 px-1 py-3 text-left ${ADMIN_FOCUS}`}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-brand-black">{p.name}</p>
          <p className="text-[12px] text-brand-text/60">
            {p.productTypeName} · {p.category} · {plural(p.variants.length, "variant")}
            {p.action === "update" || p.action === "skip" ? ` · ${plural(changedVariants + p.changes.length, "change")}` : ""}
          </p>
        </div>
        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-brand-text/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="pb-4">
          {p.changes.length ? (
            <ul className="mb-3 space-y-1 text-[12.5px]">
              {p.changes.map((c) => (
                <li key={c.field}>
                  <span className="font-semibold">{c.field}:</span> <span className="text-brand-text/60 line-through">{c.from}</span> → {c.to}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="overflow-x-auto rounded-lg border border-[#efe6d4]">
            <table className="w-full min-w-[520px] text-left text-[12.5px]">
              <thead className="bg-[#faf6ee] text-brand-text/70">
                <tr>
                  <th className="px-3 py-2 font-semibold">Size</th>
                  <th className="px-3 py-2 font-semibold">Price</th>
                  <th className="px-3 py-2 font-semibold">Stock</th>
                  <th className="px-3 py-2 font-semibold">SKU</th>
                  <th className="px-3 py-2 font-semibold">Row</th>
                  <th className="px-3 py-2 font-semibold">Change</th>
                </tr>
              </thead>
              <tbody>
                {p.variants.map((v) => (
                  <tr key={v.variantId} className="border-t border-[#f3ecdf]">
                    <td className="px-3 py-2">{v.label}</td>
                    <td className="px-3 py-2 tabular-nums">₹{v.priceInr.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 tabular-nums">{v.stockQuantity}</td>
                    <td className="px-3 py-2 font-mono text-[11.5px]">{v.sku}</td>
                    <td className="px-3 py-2 tabular-nums">{v.rowNumber}</td>
                    <td className="px-3 py-2 text-brand-text/70">
                      {v.action === "create" ? "New variant" : v.action === "unchanged" ? "No change" : v.changes.map((c) => `${c.field} ${c.from} → ${c.to}`).join("; ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function ProductImport() {
  const [step, setStep] = useState<Step>("upload");
  const { feedback, setFeedback, clear } = useFeedback();
  const [busy, setBusy] = useState<null | "reading" | "checking" | "importing">(null);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [typeMap, setTypeMap] = useState<Record<string, string>>({});
  const [titleCaseNames, setTitleCaseNames] = useState(true);
  const [options, setOptions] = useState<ImportOptions>({ updateExisting: false, activateNewProducts: false });
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [filter, setFilter] = useState<"all" | PlannedProduct["action"]>("all");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/product-types")
      .then((r) => r.json())
      .then((d: { ok?: boolean; items?: ProductType[] }) => setProductTypes(d.ok && Array.isArray(d.items) ? d.items.filter((t) => t.status !== "INACTIVE") : []))
      .catch(() => setProductTypes([]));
  }, []);

  const matrix = useMemo(() => sheets[sheetIndex]?.matrix ?? [], [sheets, sheetIndex]);
  const headerRow = useMemo(() => findHeaderRow(matrix), [matrix]);
  const headers = useMemo(() => matrix[headerRow] ?? [], [matrix, headerRow]);
  const firstData = matrix[headerRow + 1] ?? [];
  const dataRowCount = useMemo(() => matrix.slice(headerRow + 1).filter((r) => r.some((c) => cellText(c).trim() !== "")).length, [matrix, headerRow]);

  /** Distinct Type values in the file (by comparison key), with their first spelling. */
  const typeValues = useMemo(() => {
    const col = mapping.type;
    if (col === undefined) return [] as { key: string; label: string; count: number }[];
    const seen = new Map<string, { key: string; label: string; count: number }>();
    for (const r of matrix.slice(headerRow + 1)) {
      const label = cellText(r[col]).trim();
      const key = typeKey(label);
      if (!key) continue;
      const e = seen.get(key) ?? { key, label, count: 0 };
      e.count++;
      seen.set(key, e);
    }
    return [...seen.values()];
  }, [mapping.type, matrix, headerRow]);

  // Suggest product types for new Type values (the admin can change them).
  useEffect(() => {
    if (!productTypes.length) return;
    setTypeMap((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const t of typeValues) {
        if (next[t.key] === undefined) {
          const s = suggestProductType(t.label, productTypes);
          if (s) {
            next[t.key] = s;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [typeValues, productTypes]);

  const missingFields = REQUIRED_IMPORT_FIELDS.filter((f) => mapping[f] === undefined);
  const unmappedTypes = typeValues.filter((t) => !typeMap[t.key]);
  const canCheck = missingFields.length === 0 && unmappedTypes.length === 0 && dataRowCount > 0;

  const reset = () => {
    setStep("upload");
    setSheets([]);
    setFileName("");
    setPlan(null);
    setResult(null);
    setMapping({});
    setTypeMap({});
    setOptions({ updateExisting: false, activateNewProducts: false });
    clear();
  };

  const readFile = async (file: File) => {
    clear();
    const { isAcceptedFileName, readSpreadsheet } = await import("@/lib/catalogue/spreadsheet");
    if (!isAcceptedFileName(file.name)) return setFeedback({ tone: "error", message: "Please choose an Excel file ending in .xlsx or .xls." });
    if (file.size > MAX_FILE_BYTES) return setFeedback({ tone: "error", message: "This file is larger than 5 MB. Please split it into smaller files." });
    setBusy("reading");
    try {
      const read = readSpreadsheet(await file.arrayBuffer()).filter((s) => s.matrix.some((r) => r.some((c) => cellText(c).trim() !== "")));
      if (!read.length) throw new Error("This file has no rows to import.");
      setSheets(read);
      setSheetIndex(0);
      setFileName(file.name);
      const m = read[0].matrix;
      setMapping(autoMapColumns(m[findHeaderRow(m)] ?? []));
      setStep("map");
    } catch (e) {
      setFeedback({ tone: "error", message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const chooseSheet = (i: number) => {
    setSheetIndex(i);
    const m = sheets[i]?.matrix ?? [];
    setMapping(autoMapColumns(m[findHeaderRow(m)] ?? []));
  };

  const request = (opts: ImportOptions) => ({ rows: extractRows(matrix, mapping, headerRow), typeMap, titleCaseNames, options: opts });

  const check = async (opts = options) => {
    clear();
    setBusy("checking");
    try {
      const { status, data } = await postJson<{ plan?: ImportPlan }>("/api/admin/products/import/preview", request(opts));
      if (status !== 200 || !data.plan) throw new Error(data.message ?? "The file could not be checked. Please try again.");
      setPlan(data.plan);
      setStep("review");
    } catch (e) {
      setFeedback({ tone: "error", message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const changeOption = (patch: Partial<ImportOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    void check(next);
  };

  const runImport = async () => {
    if (!plan) return;
    setBusy("importing");
    clear();
    try {
      const { status, data } = await postJson<{ result?: ImportResult }>("/api/admin/products/import/apply", { ...request(options), fingerprint: plan.fingerprint });
      setConfirming(false);
      if (!data.result) throw new Error(data.message ?? "The import could not be completed. Nothing was changed.");
      if (status === 409 || data.result.status === "changed_since_preview") {
        setPlan(data.result.plan);
        setFeedback({ tone: "error", message: "Products changed since you reviewed this file. The review below is updated: please check it and import again." });
        return;
      }
      setResult(data.result);
      setStep("done");
    } catch (e) {
      setConfirming(false);
      setFeedback({ tone: "error", message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const downloadRowsToFix = async () => {
    if (!plan) return;
    const { buildRowsToFixWorkbook } = await import("@/lib/catalogue/spreadsheet");
    const byRow = new Map<number, string[]>();
    for (const i of plan.issues.filter((x) => x.kind === "error")) byRow.set(i.rowNumber, [...(byRow.get(i.rowNumber) ?? []), i.message]);
    const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([rowNumber, problems]) => ({ rowNumber, cells: matrix[rowNumber - 1] ?? [], problems: problems.join("; ") }));
    const data = buildRowsToFixWorkbook(headers, rows);
    const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/\.(xlsx|xls)$/i, "") || "products"} - rows to fix.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const nameOfRow = (rowNumber: number) => (mapping.name !== undefined ? cellText(matrix[rowNumber - 1]?.[mapping.name]) : "");
  const toImport = plan ? plan.products.filter((p) => p.action === "create" || p.action === "update").length : 0;
  const visibleProducts = plan ? plan.products.filter((p) => filter === "all" || p.action === filter) : [];

  return (
    <div className="space-y-6" data-product-import>
      <div>
        <Link href="/admin/products" className={`inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-brand-text/70 hover:text-brand-black ${ADMIN_FOCUS}`}>
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to products
        </Link>
      </div>
      <PageIntro
        eyebrow="Products"
        title="Import from Excel"
        description="Add or update fragrances and their sizes from a spreadsheet. You will see exactly what changes before anything is saved."
      />
      <Stepper step={step} />
      <FeedbackBanner feedback={feedback} onDismiss={clear} />

      {/* ---------------------------------------------------------- 1. Upload */}
      {step === "upload" ? (
        <Card icon={<FileSpreadsheet className="size-4.5" strokeWidth={1.5} />} title="Upload your Excel file" description="One row per size, for example: Product Name, Type, Size (ml), Price, Category, Stock, SKU, Notes.">
          <div
            onDragOver={(e: DragEvent) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void readFile(f);
            }}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${dragOver ? "border-brand-gold bg-brand-cream" : "border-[#d9c79f] bg-[#fffdf8]"}`}
            data-import-dropzone
          >
            <UploadCloud aria-hidden="true" className="size-9 text-[#c6a76a]" strokeWidth={1.4} />
            <p className="mt-3 text-[15px] font-semibold text-brand-black">Drag your file here</p>
            <p className="mt-1 text-[13px] text-brand-text/60">.xlsx or .xls, up to 5 MB and 2,000 rows</p>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy !== null} className={`${BTN_PRIMARY} mt-5`}>
              {busy === "reading" ? <Spinner label="Reading file…" /> : "Choose file"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="sr-only"
              aria-label="Excel file to import"
              data-import-file
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void readFile(f);
              }}
            />
          </div>
          <p className="mt-3 text-[12.5px] text-brand-text/60">The file is read on this computer. Nothing is saved until you confirm the import.</p>
        </Card>
      ) : null}

      {/* ---------------------------------------------------- 2. Match columns */}
      {step === "map" ? (
        <>
          <Card
            icon={<Columns3 className="size-4.5" strokeWidth={1.5} />}
            title="Match your columns"
            description={`${fileName} · ${plural(dataRowCount, "row")} · headings read from row ${headerRow + 1}. Columns were matched automatically; change any that are wrong.`}
          >
            {sheets.length > 1 ? (
              <label className="mb-4 block max-w-sm">
                <span className="text-[13px] font-semibold text-brand-black">Sheet</span>
                <select className={`${INPUT} mt-1.5 h-10`} value={sheetIndex} onChange={(e) => chooseSheet(Number(e.target.value))}>
                  {sheets.map((s, i) => (
                    <option key={s.name} value={i}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {IMPORT_FIELDS.map((field: ImportField) => {
                const col = mapping[field];
                const required = REQUIRED_IMPORT_FIELDS.includes(field);
                return (
                  <label key={field} className="block rounded-xl border border-[#efe6d4] bg-[#fffdf8] p-3" data-map-field={field}>
                    <span className="flex items-center justify-between gap-2 text-[13px] font-semibold text-brand-black">
                      {IMPORT_FIELD_LABELS[field]}
                      {required ? <StatusBadge tone={col === undefined ? "danger" : "neutral"}>Required</StatusBadge> : <StatusBadge>Optional</StatusBadge>}
                    </span>
                    <select
                      className={`${INPUT} mt-2 h-10`}
                      value={col ?? ""}
                      onChange={(e) => setMapping({ ...mapping, [field]: e.target.value === "" ? undefined : Number(e.target.value) })}
                    >
                      <option value="">{required ? "Choose a column…" : "Not in this file"}</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          Column {colName(i)}: {cellText(h) || "(no heading)"}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1.5 block truncate text-[12px] text-brand-text/55">Example: {col !== undefined ? cellText(firstData[col]) || "(empty)" : "-"}</span>
                  </label>
                );
              })}
            </div>
            <label className="mt-4 flex items-start gap-2.5 text-[13.5px]">
              <input type="checkbox" className="mt-0.5 size-4 accent-[#161513]" checked={titleCaseNames} onChange={(e) => setTitleCaseNames(e.target.checked)} />
              <span>
                Tidy names written in capitals
                {mapping.name !== undefined && cellText(firstData[mapping.name]) ? (
                  <span className="text-brand-text/60"> (“{cellText(firstData[mapping.name])}” becomes “{toTitleCase(cellText(firstData[mapping.name]).trim())}”)</span>
                ) : null}
              </span>
            </label>
          </Card>

          <Card icon={<Tags className="size-4.5" strokeWidth={1.5} />} title="Match product types" description="Each Type in your file must be one of your product types.">
            {mapping.type === undefined ? (
              <p className="text-[13.5px] text-brand-text/65">Choose the Type column above first.</p>
            ) : typeValues.length === 0 ? (
              <p className="text-[13.5px] text-brand-text/65">The Type column is empty.</p>
            ) : (
              <ul className="space-y-2.5">
                {typeValues.map((t) => (
                  <li key={t.key} className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]" data-map-type={t.key}>
                    <span className="text-[13.5px]">
                      <span className="font-semibold">“{t.label}”</span> <span className="text-brand-text/55">({plural(t.count, "row")})</span>
                    </span>
                    <span aria-hidden="true" className="hidden text-brand-text/40 sm:block">→</span>
                    <select className={`${INPUT} h-10`} aria-label={`Product type for ${t.label}`} value={typeMap[t.key] ?? ""} onChange={(e) => setTypeMap({ ...typeMap, [t.key]: e.target.value })}>
                      <option value="">Choose a product type…</option>
                      {productTypes.map((pt) => (
                        <option key={pt.id} value={pt.id}>
                          {pt.name}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={reset} className={BTN_SECONDARY}>
              <RotateCcw aria-hidden="true" className="size-4" /> Choose another file
            </button>
            <div className="flex items-center gap-3">
              {!canCheck ? (
                <p className="text-[12.5px] text-[#8a2f22]" data-map-blocker>
                  {missingFields.length ? `Match: ${missingFields.map((f) => IMPORT_FIELD_LABELS[f]).join(", ")}` : unmappedTypes.length ? "Choose a product type for every Type value" : "No rows to import"}
                </p>
              ) : null}
              <button type="button" onClick={() => void check()} disabled={!canCheck || busy !== null} className={BTN_PRIMARY} data-action="check-file">
                {busy === "checking" ? <Spinner label="Checking…" /> : "Check file"}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {/* ----------------------------------------------------------- 3. Review */}
      {step === "review" && plan ? (
        <>
          <section aria-label="Import totals" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Tile label="New products" value={plan.totals.newProducts} tone="success" />
            <Tile label="New variants" value={plan.totals.newVariants} tone="success" />
            <Tile label="Existing records to update" value={plan.totals.existingRecordsToUpdate} tone="warning" hint={plan.totals.existingProductsAffected ? plural(plan.totals.existingProductsAffected, "product") : undefined} />
            <Tile label="Duplicates skipped" value={plan.totals.duplicates} />
            <Tile label="Rows with problems" value={plan.totals.invalidRows} tone={plan.totals.invalidRows ? "danger" : "neutral"} hint={plan.totals.invalidRows ? "Not imported" : undefined} />
          </section>
          <p className="text-[12.5px] text-brand-text/60">
            {plural(plan.totals.rows, "row")} read
            {plan.totals.unchangedRows ? ` · ${plural(plan.totals.unchangedRows, "row")} already up to date` : ""}
            {plan.totals.existingSkipped ? ` · ${plural(plan.totals.existingSkipped, "existing product")} with differences not updated` : ""}
          </p>

          <Card icon={<ListChecks className="size-4.5" strokeWidth={1.5} />} title="Import settings">
            <div className="space-y-3">
              <label className="flex items-start gap-2.5 text-[13.5px]">
                <input type="checkbox" className="mt-0.5 size-4 accent-[#161513]" checked={options.updateExisting} disabled={busy !== null} onChange={(e) => changeOption({ updateExisting: e.target.checked })} data-option="update-existing" />
                <span>
                  <span className="font-semibold">Update products that already exist</span>
                  <span className="block text-brand-text/60">Changes their prices, stock, missing SKUs, category and notes as shown below. Names, photos and existing SKUs are never changed. Off: existing products are left as they are.</span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-[13.5px]">
                <input type="checkbox" className="mt-0.5 size-4 accent-[#161513]" checked={options.activateNewProducts} disabled={busy !== null} onChange={(e) => changeOption({ activateNewProducts: e.target.checked })} data-option="activate-new" />
                <span>
                  <span className="font-semibold">Show new products on the website now</span>
                  <span className="block text-brand-text/60">Off (recommended): new products are saved as Hidden so you can add photos first, then make them visible in Products.</span>
                </span>
              </label>
            </div>
          </Card>

          {plan.issues.length ? (
            <Card
              icon={<AlertTriangle className="size-4.5" strokeWidth={1.5} />}
              title={plan.totals.invalidRows ? `${plural(plan.totals.invalidRows, "row")} need attention` : "Notes about your file"}
              description={plan.totals.invalidRows ? "These rows will not be imported. Fix them in Excel and import the corrected file; rows already imported will show as up to date." : undefined}
              actions={
                plan.totals.invalidRows ? (
                  <button type="button" onClick={() => void downloadRowsToFix()} className={BTN_SECONDARY} data-action="download-rows-to-fix">
                    <Download aria-hidden="true" className="size-4" /> Download rows to fix
                  </button>
                ) : undefined
              }
            >
              <div className="max-h-80 overflow-auto rounded-lg border border-[#efe6d4]">
                <table className="w-full min-w-[480px] text-left text-[12.5px]" data-issues>
                  <thead className="sticky top-0 bg-[#faf6ee] text-brand-text/70">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Row</th>
                      <th className="px-3 py-2 font-semibold">Product</th>
                      <th className="px-3 py-2 font-semibold">Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.issues.map((i, n) => (
                      <tr key={`${i.rowNumber}-${n}`} className="border-t border-[#f3ecdf]" data-issue-kind={i.kind}>
                        <td className="px-3 py-2 tabular-nums">{i.rowNumber}</td>
                        <td className="px-3 py-2">{nameOfRow(i.rowNumber) || "-"}</td>
                        <td className={`px-3 py-2 ${i.kind === "error" ? "text-[#8a2f22]" : "text-brand-text/65"}`}>
                          {i.field ? <span className="font-semibold">{IMPORT_FIELD_LABELS[i.field]}: </span> : null}
                          {i.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          <Card icon={<PackagePlus className="size-4.5" strokeWidth={1.5} />} title="Products in this file" description="Open a product to see every size and what will change.">
            <FilterTabs
              label="Show products"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: `All (${plan.products.length})` },
                { value: "create", label: `New (${plan.products.filter((p) => p.action === "create").length})` },
                { value: "update", label: `Updates (${plan.products.filter((p) => p.action === "update").length})` },
                { value: "skip", label: `Not updated (${plan.products.filter((p) => p.action === "skip").length})` },
                { value: "unchanged", label: `Up to date (${plan.products.filter((p) => p.action === "unchanged").length})` },
              ]}
            />
            {visibleProducts.length ? (
              <ul className="mt-3">
                {visibleProducts.map((p) => (
                  <ProductRow key={p.productId} p={p} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13.5px] text-brand-text/60">No products in this view.</p>
            )}
          </Card>

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e3d6bd] bg-[#f6f2ea]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
            <button type="button" onClick={() => setStep("map")} disabled={busy !== null} className={BTN_SECONDARY}>
              <ArrowLeft aria-hidden="true" className="size-4" /> Back
            </button>
            <div className="flex items-center gap-3">
              {busy === "checking" ? <Spinner label="Updating review…" /> : null}
              <button type="button" onClick={() => setConfirming(true)} disabled={toImport === 0 || busy !== null} className={BTN_PRIMARY} data-action="start-import">
                {toImport === 0 ? "Nothing to import" : `Import ${plural(toImport, "product")}`}
              </button>
            </div>
          </div>

          <ConfirmDialog
            open={confirming}
            title="Import these products?"
            confirmLabel={busy === "importing" ? "Importing…" : "Import now"}
            tone="primary"
            busy={busy === "importing"}
            onConfirm={() => void runImport()}
            onCancel={() => setConfirming(false)}
          >
            <ul className="list-disc space-y-1 pl-5 text-[13.5px]">
              <li>{plural(plan.totals.newProducts, "new product")} ({options.activateNewProducts ? "visible on the website" : "saved as Hidden"})</li>
              <li>{plural(plan.totals.newVariants, "new variant")}</li>
              <li>{plural(plan.totals.existingRecordsToUpdate, "existing record")} updated</li>
              {plan.totals.invalidRows ? <li>{plural(plan.totals.invalidRows, "row")} with problems will be skipped</li> : null}
            </ul>
            <p className="mt-3 text-[12.5px] text-brand-text/65">If anything fails, the products saved by this import are undone automatically.</p>
          </ConfirmDialog>
        </>
      ) : null}

      {/* ----------------------------------------------------------- 4. Result */}
      {step === "done" && result ? (
        <ResultView result={result} onAgain={reset} />
      ) : null}
    </div>
  );
}

function ResultView({ result, onAgain }: { result: ImportResult; onAgain: () => void }) {
  const ok = result.status === "completed";
  const created = result.applied.filter((a) => a.action === "created");
  const updated = result.applied.filter((a) => a.action === "updated");
  const actions: ReactNode = (
    <div className="mt-5 flex flex-wrap gap-2.5">
      <Link href="/admin/products" className={`${BTN_PRIMARY} ${ADMIN_FOCUS}`}>
        Go to products
      </Link>
      <button type="button" onClick={onAgain} className={BTN_SECONDARY}>
        Import another file
      </button>
    </div>
  );
  if (!ok) {
    return (
      <section className="rounded-2xl border border-[#e2b4ab] bg-[#fbeeeb] p-5 sm:p-6" data-import-result="rolled-back">
        <h2 className="flex items-center gap-2 font-serif text-[22px] font-semibold text-[#8a2f22]">
          <AlertTriangle aria-hidden="true" className="size-5" /> The import was stopped
        </h2>
        <p className="mt-2 text-[14px] text-brand-black">
          {result.failure ? `“${result.failure.name}” could not be saved: ${result.failure.message}` : "The import could not be completed."}{" "}
          {result.rollbackProblems.length === 0 ? "Everything this import had saved was undone, so your products are exactly as before." : null}
        </p>
        {result.rollbackProblems.length ? (
          <ul className="mt-3 list-disc pl-5 text-[13.5px] text-[#8a2f22]">
            {result.rollbackProblems.map((p) => (
              <li key={p.productId}>
                {p.productId}: {p.message}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-[13px] text-brand-text/70">You can try again: open the file again and review it.</p>
        {actions}
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-[#b9d4b3] bg-[#eef6ec] p-5 sm:p-6" data-import-result="completed">
      <h2 className="flex items-center gap-2 font-serif text-[22px] font-semibold text-[#2f5f2a]">
        <CheckCircle2 aria-hidden="true" className="size-5" /> Import complete
      </h2>
      <p className="mt-2 text-[14px] text-brand-black">
        {plural(created.length, "new product")} with {plural(created.reduce((n, a) => n + a.variantsCreated, 0), "variant")}
        {updated.length ? `, ${plural(updated.length, "existing product")} updated` : ""}.
        {created.length && result.plan.products.find((p) => p.action === "create")?.status === "INACTIVE" ? " New products are Hidden: add photos, then make them visible in Products." : ""}
      </p>
      <details className="mt-3">
        <summary className={`cursor-pointer text-[13.5px] font-semibold ${ADMIN_FOCUS}`}>Show details</summary>
        <ul className="mt-2 grid gap-1 text-[13px] sm:grid-cols-2">
          {result.applied.map((a) => (
            <li key={a.productId}>
              <span className="font-semibold">{a.name}</span>: {a.action === "created" ? `created with ${plural(a.variantsCreated, "variant")}` : `${plural(a.variantsUpdated, "variant")} updated, ${a.variantsCreated} added`}
            </li>
          ))}
        </ul>
      </details>
      {actions}
    </section>
  );
}
