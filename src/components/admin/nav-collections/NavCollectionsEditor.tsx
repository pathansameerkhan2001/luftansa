"use client";

/**
 * Admin: the header's COLLECTIONS dropdown and its collection pages, on the
 * existing CMS (save a draft, preview, publish, or deactivate, which removes
 * the COLLECTIONS menu). Per collection: name, web address, description,
 * image (Media Library), active switch, order, and its products, either every
 * product of one product type or a hand-picked list in a chosen order.
 *
 * Products are never changed here: membership is stored with the collection,
 * so no product record or product schema is touched.
 */
import { ArrowDown, ArrowUp, ExternalLink, ImageIcon, LayoutList, ListChecks, Menu, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, TextField } from "@/components/admin/cms/FormFields";
import { MediaField, useMediaLibrary } from "@/components/admin/cms/MediaPicker";
import { PreviewFrame } from "@/components/admin/cms/PreviewFrame";
import { PublishBar } from "@/components/admin/cms/PublishBar";
import { useCmsSingleton, useUnsavedChangesWarning } from "@/components/admin/cms/useCmsEntry";
import { adminFetch, BTN_ICON, BTN_SECONDARY, ConfirmDialog, FeedbackBanner, FilterTabs, INPUT, PageIntro, SearchField, Spinner, StatusBadge, useFeedback } from "@/components/admin/cms/ui";
import {
  collectionHref,
  MAX_NAV_COLLECTION_PRODUCTS,
  MAX_NAV_COLLECTIONS,
  NAV_COLLECTIONS_DEFAULT,
  NAV_COLLECTIONS_MODULE,
  navCollectionsPayloadSchema,
  selectNavCollectionProducts,
  type NavCollection,
  type NavCollectionsPayload,
} from "@/lib/cms/modules/nav-collections";

/** Editable form: optional fields as plain strings ("" = not set); the schema normalises them. */
interface CollectionForm {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageKey: string;
  imageAlt: string;
  enabled: boolean;
  linkTo: string;
  selection: { mode: "product-type" | "manual"; productTypeId: string; productIds: string[] };
}
interface Form {
  menuLabel: string;
  collections: CollectionForm[];
}

interface AdminProduct {
  slug: string;
  name: string;
  productTypeId?: string;
  status: string;
  displayOrder?: number;
}
interface ProductType {
  id: string;
  name: string;
  status: string;
}

function toForm(raw: unknown): Form {
  const parsed = navCollectionsPayloadSchema.safeParse(raw);
  const p: NavCollectionsPayload = parsed.success ? parsed.data : NAV_COLLECTIONS_DEFAULT;
  return {
    menuLabel: p.menuLabel,
    collections: p.collections.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? "",
      imageKey: c.imageKey ?? "",
      imageAlt: c.imageAlt ?? "",
      enabled: c.enabled,
      linkTo: c.linkTo ?? "",
      selection: { mode: c.selection.mode, productTypeId: c.selection.productTypeId ?? "", productIds: [...c.selection.productIds] },
    })),
  };
}

type Check = { ok: true; payload: NavCollectionsPayload } | { ok: false; errors: Record<string, string> };

/** Same rules as the server. Errors keyed "menuLabel" or "<index>.<field>". */
function validate(f: Form): Check {
  const parsed = navCollectionsPayloadSchema.safeParse(f);
  if (parsed.success) return { ok: true, payload: parsed.data };
  const errors: Record<string, string> = {};
  for (const i of parsed.error.issues) {
    const [top, index, ...rest] = i.path;
    const key = top === "collections" && typeof index === "number" ? `${index}.${rest.filter((r) => r !== "selection").join(".") || "list"}` : String(top ?? "form");
    errors[key] ??= i.message;
  }
  return { ok: false, errors };
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export function NavCollectionsEditor() {
  const cms = useCmsSingleton(NAV_COLLECTIONS_MODULE.id);
  const library = useMediaLibrary();
  const { feedback, setFeedback, clear } = useFeedback();
  const saved = useMemo(() => toForm(cms.entry?.draft ?? NAV_COLLECTIONS_DEFAULT), [cms.entry]);
  const [edited, setEdited] = useState<{ base: Form; form: Form } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CollectionForm | null>(null);
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [types, setTypes] = useState<ProductType[] | null>(null);
  const [loadIssue, setLoadIssue] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const form = edited && edited.base === saved ? edited.form : saved;
  const set = (next: Form) => setEdited({ base: saved, form: next });
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useUnsavedChangesWarning(dirty);

  useEffect(() => {
    adminFetch<{ items: { id: string; name: string; productTypeId?: string; status: string; displayOrder?: number }[] }>("/api/admin/products").then(
      (r) => setProducts(r.items.map((p) => ({ slug: p.id, name: p.name, productTypeId: p.productTypeId, status: p.status, displayOrder: p.displayOrder }))),
      (e: Error) => setLoadIssue(e.message),
    );
    adminFetch<{ items: ProductType[] }>("/api/admin/product-types").then(
      (r) => setTypes(r.items),
      (e: Error) => setLoadIssue(e.message),
    );
  }, []);

  const check = validate(form);
  const errors = showErrors && !check.ok ? check.errors : {};
  const selectedIndex = Math.max(0, form.collections.findIndex((c) => c.id === selectedId));
  const selected: CollectionForm | undefined = form.collections[selectedIndex];
  const activeProducts = useMemo(() => (products ?? []).filter((p) => p.status === "ACTIVE"), [products]);
  const productBySlug = useMemo(() => new Map((products ?? []).map((p) => [p.slug, p])), [products]);
  const typeName = (id: string | undefined) => (id ? (types?.find((t) => t.id === id)?.name ?? id) : "Perfume Spray");

  const updateCollection = (i: number, patch: Partial<CollectionForm>) => set({ ...form, collections: form.collections.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const updateSelection = (i: number, patch: Partial<CollectionForm["selection"]>) => updateCollection(i, { selection: { ...form.collections[i].selection, ...patch } });
  const move = (i: number, d: -1 | 1) => {
    const next = [...form.collections];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    set({ ...form, collections: next });
  };
  const add = () => {
    const id = `collection-${Date.now().toString(36)}`;
    const c: CollectionForm = { id, name: "New collection", slug: `new-collection-${form.collections.length + 1}`, description: "", imageKey: "", imageAlt: "", enabled: false, linkTo: "", selection: { mode: "manual", productTypeId: "", productIds: [] } };
    set({ ...form, collections: [...form.collections, c] });
    setSelectedId(id);
  };
  const remove = (c: CollectionForm) => {
    set({ ...form, collections: form.collections.filter((x) => x.id !== c.id) });
    setRemoving(null);
    if (selectedId === c.id) setSelectedId(null);
  };

  /** Products a collection shows today (active products only). */
  const membersOf = (c: CollectionForm) =>
    selectNavCollectionProducts({ selection: { mode: c.selection.mode, productTypeId: c.selection.productTypeId || undefined, productIds: c.selection.productIds } } as Pick<NavCollection, "selection">, activeProducts);

  const attempt = async (action: "save" | "publish") => {
    clear();
    if (!check.ok) {
      setShowErrors(true);
      const firstIndex = Object.keys(check.errors).map((k) => Number(k.split(".")[0])).find((n) => Number.isInteger(n));
      if (firstIndex !== undefined && form.collections[firstIndex]) setSelectedId(form.collections[firstIndex].id);
      setFeedback({ tone: "error", message: "Please fix the highlighted fields." });
      return;
    }
    const payload = check.payload as unknown as Record<string, unknown>;
    try {
      if (action === "save") {
        await cms.saveDraft(payload);
        setFeedback({ tone: "success", message: "Draft saved. The website is unchanged until you publish." });
      } else {
        await cms.publish(dirty || !cms.entry ? payload : undefined);
        setFeedback({ tone: "success", message: "Published. The header menu and collection pages are updated." });
      }
      setShowErrors(false);
      setEdited(null);
    } catch (e) {
      setFeedback({ tone: "error", message: (e as Error).message });
    }
  };

  if (cms.loading && !cms.entry) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Website" title="Collections Menu" />
        <Spinner label="Loading the collections…" />
      </div>
    );
  }
  if (cms.loadError) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Website" title="Collections Menu" />
        <FeedbackBanner feedback={{ tone: "error", message: cms.loadError }} onDismiss={() => void cms.reload()} />
      </div>
    );
  }

  const i = selectedIndex;
  const err = (field: string) => errors[`${i}.${field}`];
  const chosen = selected?.selection.productIds ?? [];
  const q = search.trim().toLowerCase();
  const candidates = (products ?? []).filter((p) => !chosen.includes(p.slug) && (!q || p.name.toLowerCase().includes(q) || p.slug.includes(q))).slice(0, 40);
  const previewSlug = selected ? encodeURIComponent(selected.slug) : "";

  return (
    <div className="space-y-6" data-nav-collections-editor>
      <PageIntro
        eyebrow="Website"
        title="Collections Menu"
        description="The COLLECTIONS dropdown in the website header and the pages it opens. Choose each collection's name, web address, description, image, products and order. Save a draft, check the preview, then publish. Deactivate removes the COLLECTIONS menu from the header."
      />

      <PublishBar
        entry={cms.entry}
        dirty={dirty}
        busy={cms.busy}
        sectionLabel="Collections Menu"
        onSave={() => void attempt("save")}
        onPublish={() => void attempt("publish")}
        onUnpublish={() =>
          cms.unpublish().then(
            () => setFeedback({ tone: "success", message: "The COLLECTIONS menu is now hidden and its collection pages are offline." }),
            (e: Error) => setFeedback({ tone: "error", message: e.message }),
          )
        }
        onDiscard={() => {
          setEdited(null);
          setShowErrors(false);
          clear();
        }}
      />

      <FeedbackBanner feedback={feedback} onDismiss={clear} />
      {!cms.entry ? (
        <p className="rounded-xl border border-[#e5c98f] bg-[#fdf4e2] px-4 py-3 text-[13.5px] text-[#7a5a2b]" data-default-note>
          The website currently shows the default menu below (Roll-On, Air Freshener and Car Freshener). Edit it, then publish to replace it.
        </p>
      ) : null}
      {loadIssue ? <FeedbackBanner feedback={{ tone: "error", message: `Products could not be loaded: ${loadIssue}` }} onDismiss={() => setLoadIssue(null)} /> : null}

      <Card icon={<Menu className="size-4.5" strokeWidth={1.5} />} title="Menu">
        <TextField id="menu-label" label="Menu label" required value={form.menuLabel} max={24} error={errors.menuLabel} onChange={(menuLabel) => set({ ...form, menuLabel })} help="Shown in the header between PERFUMES and OUR STORY (upper case on the website)." />
      </Card>

      <Card
        icon={<LayoutList className="size-4.5" strokeWidth={1.5} />}
        title="Collections"
        description={`Shown in this order. Only active collections appear in the menu; an inactive collection's page is offline. ${form.collections.filter((c) => c.enabled).length} of ${form.collections.length} active.`}
        actions={
          <button type="button" className={BTN_SECONDARY} onClick={add} disabled={form.collections.length >= MAX_NAV_COLLECTIONS} data-add-collection>
            <Plus aria-hidden="true" className="size-4" /> Add collection
          </button>
        }
      >
        {form.collections.length === 0 ? <p className="text-[13.5px] text-brand-text/65">No collections. The COLLECTIONS menu is hidden until one is added and made active.</p> : null}
        <ol className="space-y-2">
          {form.collections.map((c, j) => {
            const count = products ? membersOf(c).length : null;
            const hasError = showErrors && Object.keys(errors).some((k) => k.startsWith(`${j}.`));
            const isSelected = j === i;
            return (
              <li key={c.id} className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 ${isSelected ? "border-brand-black bg-[#fffaf0]" : "border-[#eee3cc] bg-[#fffdf8]"} ${hasError ? "ring-1 ring-[#9a3b2b]" : ""}`} data-collection-row={c.id}>
                <span className="w-5 text-right text-[13px] text-brand-text/45 tabular-nums">{j + 1}</span>
                <label className="flex items-center gap-2 text-[13px] font-medium">
                  <input type="checkbox" className="size-4 accent-[#161513]" checked={c.enabled} onChange={(e) => updateCollection(j, { enabled: e.target.checked })} data-field={`${c.id}-enabled`} />
                  Active
                </label>
                <button type="button" onClick={() => setSelectedId(c.id)} className="min-w-[180px] flex-1 text-left" aria-pressed={isSelected}>
                  <span className="block text-[14px] font-semibold text-brand-black">{c.name || "Untitled collection"}</span>
                  <span className="block text-[12px] text-brand-text/60">
                    {collectionHref({ slug: c.slug, linkTo: c.linkTo || undefined })} · {count === null ? "…" : `${count} active product${count === 1 ? "" : "s"}`}
                    {c.enabled && count === 0 ? " · shows “coming soon”" : ""}
                  </span>
                </button>
                {!c.enabled ? <StatusBadge>Inactive</StatusBadge> : null}
                <span className="flex gap-1.5">
                  <button type="button" className={BTN_ICON} disabled={j === 0} onClick={() => move(j, -1)} aria-label={`Move ${c.name} up`}>
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" className={BTN_ICON} disabled={j === form.collections.length - 1} onClick={() => move(j, 1)} aria-label={`Move ${c.name} down`}>
                    <ArrowDown className="size-4" />
                  </button>
                  <button type="button" className={BTN_ICON} onClick={() => setRemoving(c)} aria-label={`Remove ${c.name}`}>
                    <Trash2 className="size-4" />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
        {errors["form"] ? <p className="text-[12.5px] font-medium text-[#9a3b2b]">{errors["form"]}</p> : null}
      </Card>

      {selected ? (
        <>
          <Card icon={<ListChecks className="size-4.5" strokeWidth={1.5} />} title={`Edit: ${selected.name || "Untitled collection"}`} description="Changes apply to the collection selected above.">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                id="collection-name"
                label="Name"
                required
                value={selected.name}
                max={40}
                error={err("name")}
                onChange={(name) => updateCollection(i, { name, ...(selected.slug === slugify(selected.name) || selected.slug.startsWith("new-collection") ? { slug: slugify(name) } : {}) })}
                help="Shown in the header menu and as the page title."
              />
              <TextField id="collection-slug" label="Web address" required value={selected.slug} max={60} error={err("slug")} onChange={(slug) => updateCollection(i, { slug: slug.toLowerCase() })} help={`The page address: /collections/${selected.slug || "…"}`} />
            </div>
            <TextField id="collection-description" label="Description" multiline rows={3} value={selected.description} max={400} error={err("description")} onChange={(description) => updateCollection(i, { description })} help="Introduction under the title on the collection page." />
            <TextField
              id="collection-link"
              label="Open an existing page instead"
              value={selected.linkTo}
              max={120}
              error={err("linkTo")}
              onChange={(linkTo) => updateCollection(i, { linkTo })}
              placeholder="/roll-on"
              help="Optional. A page on this site, such as /roll-on, that the menu opens instead of /collections/…. Leave empty to use the collection page (its description, image and products below)."
            />
          </Card>

          <Card icon={<ImageIcon className="size-4.5" strokeWidth={1.5} />} title="Image" description="Wide banner on the collection page (about 21:9, for example 2100×900). Not shown when the collection opens an existing page.">
            <MediaField
              id="collection-image"
              label="Collection image"
              kind="image"
              folder="categories"
              library={library}
              value={selected.imageKey || undefined}
              error={err("imageKey")}
              help="Upload a new image or choose one from the Media Library. Replacing or removing it never deletes the file from the Media Library."
              onChange={(key, a) => updateCollection(i, { imageKey: key ?? "", ...(key ? (!selected.imageAlt && a?.alt ? { imageAlt: a.alt } : {}) : { imageAlt: "" }) })}
            >
              <TextField id="collection-image-alt" label="Image description (alt text)" value={selected.imageAlt} max={200} error={err("imageAlt")} onChange={(imageAlt) => updateCollection(i, { imageAlt })} help="Describe the image for visitors using screen readers." />
            </MediaField>
          </Card>

          <Card icon={<ListChecks className="size-4.5" strokeWidth={1.5} />} title="Products" description="Which products this collection shows. Only active products are ever shown on the website. Products themselves are not changed.">
            <FilterTabs
              label="How products are chosen"
              value={selected.selection.mode}
              onChange={(mode) => updateSelection(i, { mode })}
              options={[
                { value: "product-type", label: "By product type" },
                { value: "manual", label: "Choose products" },
              ]}
            />
            {selected.selection.mode === "product-type" ? (
              <div>
                <label htmlFor="collection-type" className="text-[13.5px] font-semibold text-brand-black">
                  Product type <span className="text-[#8a2f22]">*</span>
                </label>
                <select id="collection-type" className={`${INPUT} mt-1.5 h-10 ${err("productTypeId") ? "border-[#c97f70]" : ""}`} value={selected.selection.productTypeId} onChange={(e) => updateSelection(i, { productTypeId: e.target.value })} data-field="collection-type">
                  <option value="">Choose a product type…</option>
                  {selected.selection.productTypeId && types && !types.some((t) => t.id === selected.selection.productTypeId) ? (
                    <option value={selected.selection.productTypeId}>{selected.selection.productTypeId} (not created yet)</option>
                  ) : null}
                  {(types ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.status !== "ACTIVE" ? " (inactive type)" : ""}
                    </option>
                  ))}
                </select>
                <p className={`mt-1 text-[12px] leading-snug ${err("productTypeId") ? "font-medium text-[#9a3b2b]" : "text-brand-text/55"}`}>
                  {err("productTypeId") ??
                    (types && selected.selection.productTypeId && !types.some((t) => t.id === selected.selection.productTypeId)
                      ? `No product type “${selected.selection.productTypeId}” exists yet. Create it in Admin → Products (product type) when adding the first product; until then the page shows “coming soon”.`
                      : "Every active product of this type, in the product display order. New products of this type appear automatically.")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-[13.5px] font-semibold text-brand-black">
                    Chosen products ({chosen.length}/{MAX_NAV_COLLECTION_PRODUCTS})
                  </p>
                  {err("productIds") ? <p className="mt-1 text-[12px] font-medium text-[#9a3b2b]">{err("productIds")}</p> : null}
                  {chosen.length === 0 ? (
                    <p className="mt-1 text-[13px] text-brand-text/60">No products yet. The collection page shows “coming soon” until products are added.</p>
                  ) : (
                    <ol className="mt-2 space-y-1.5">
                      {chosen.map((id, k) => {
                        const p = productBySlug.get(id);
                        return (
                          <li key={id} className="flex items-center gap-2 rounded-lg border border-[#eee3cc] bg-white px-3 py-1.5" data-chosen-product={id}>
                            <span className="w-5 text-right text-[12px] text-brand-text/45 tabular-nums">{k + 1}</span>
                            <span className="min-w-0 flex-1 truncate text-[13.5px]">
                              {p?.name ?? id} <span className="text-[12px] text-brand-text/55">· {typeName(p?.productTypeId)}</span>
                              {!p ? <span className="text-[12px] text-[#9a3b2b]"> · product not found (not shown)</span> : p.status !== "ACTIVE" ? <span className="text-[12px] text-[#9a3b2b]"> · inactive (not shown)</span> : null}
                            </span>
                            <button type="button" className={`${BTN_ICON} h-8 w-8`} disabled={k === 0} onClick={() => updateSelection(i, { productIds: chosen.map((x, n) => (n === k - 1 ? id : n === k ? chosen[k - 1] : x)) })} aria-label={`Move ${p?.name ?? id} up`}>
                              <ArrowUp className="size-3.5" />
                            </button>
                            <button type="button" className={`${BTN_ICON} h-8 w-8`} disabled={k === chosen.length - 1} onClick={() => updateSelection(i, { productIds: chosen.map((x, n) => (n === k + 1 ? id : n === k ? chosen[k + 1] : x)) })} aria-label={`Move ${p?.name ?? id} down`}>
                              <ArrowDown className="size-3.5" />
                            </button>
                            <button type="button" className={`${BTN_ICON} h-8 w-8`} onClick={() => updateSelection(i, { productIds: chosen.filter((x) => x !== id) })} aria-label={`Remove ${p?.name ?? id}`}>
                              <Trash2 className="size-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
                <div>
                  <SearchField value={search} onChange={setSearch} placeholder="Search products by name" label="Search products to add" />
                  {products === null && !loadIssue ? (
                    <Spinner label="Loading products…" />
                  ) : (
                    <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-xl border border-[#eee3cc] bg-[#fffdf8] p-2" aria-label="Products you can add">
                      {candidates.length === 0 ? <li className="px-2 py-1.5 text-[13px] text-brand-text/60">No matching products.</li> : null}
                      {candidates.map((p) => (
                        <li key={p.slug} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-white">
                          <span className="min-w-0 truncate text-[13.5px]">
                            {p.name} <span className="text-[12px] text-brand-text/55">· {typeName(p.productTypeId)}</span>
                            {p.status !== "ACTIVE" ? <span className="text-[12px] text-brand-text/55"> · inactive</span> : null}
                          </span>
                          <button type="button" className={`${BTN_SECONDARY} h-8 px-3`} disabled={chosen.length >= MAX_NAV_COLLECTION_PRODUCTS} onClick={() => updateSelection(i, { productIds: [...chosen, p.slug] })} data-add-product={p.slug}>
                            <Plus aria-hidden="true" className="size-3.5" /> Add
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1.5 text-[12px] text-brand-text/55">Keep each collection to one kind of product: for example, add only car fresheners to Car Freshener and only air fresheners to Air Freshener (never Roll-Ons).</p>
                </div>
              </div>
            )}
          </Card>

          <section className="rounded-2xl border border-[#e3d6bd] bg-white p-4 sm:p-6" aria-labelledby="collections-preview-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="collections-preview-heading" className="font-serif text-[22px] font-semibold text-brand-black">
                Preview: {selected.name}
              </h2>
              {selected.enabled && cms.entry?.status === "PUBLISHED" ? (
                <a href={collectionHref({ slug: selected.slug, linkTo: selected.linkTo || undefined })} target="_blank" rel="noreferrer" className={`${BTN_SECONDARY} h-9`}>
                  <ExternalLink aria-hidden="true" className="size-4" /> Open live page
                </a>
              ) : null}
            </div>
            <div className="mt-4">
              <PreviewFrame
                title={`${selected.name} collection`}
                draftSrc={`/admin/preview/nav-collections?version=draft&slug=${previewSlug}`}
                liveSrc={`/admin/preview/nav-collections?version=live&slug=${previewSlug}`}
                reloadKey={`${cms.entry ? cms.entry.version : "none"}-${selected.slug}`}
                note={dirty ? "The preview shows the last saved draft. Save to see your latest changes." : "The menu and this collection's page, at each device's real width."}
              />
            </div>
          </section>
        </>
      ) : null}

      <ConfirmDialog open={removing !== null} title={`Remove ${removing?.name ?? "collection"}?`} confirmLabel="Remove collection" onConfirm={() => removing && remove(removing)} onCancel={() => setRemoving(null)}>
        It disappears from the menu and its page goes offline when you publish. Products are not changed. To hide it temporarily, untick Active instead.
      </ConfirmDialog>
    </div>
  );
}
