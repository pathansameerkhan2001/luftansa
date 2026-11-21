"use client";

/**
 * Admin: homepage Personality Collection and Roll-On Collection panels, on the
 * existing CMS: save a draft, preview, publish, or deactivate (removes both
 * panels from the homepage). Same workflow as the Hero, Brand Story and Reels.
 *
 * Product facts (names, sizes, prices, images, notes and the Best Seller /
 * New Launch / Buy 1 Get 1 Free badges) stay in Admin → Products; this page
 * chooses which products each panel shows, their order and the design.
 */
import Link from "next/link";
import { ArrowDown, ArrowUp, LayoutGrid, ListChecks, Palette, Plus, Tags, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, TextField } from "@/components/admin/cms/FormFields";
import { PreviewFrame } from "@/components/admin/cms/PreviewFrame";
import { PublishBar } from "@/components/admin/cms/PublishBar";
import { useCmsSingleton, useUnsavedChangesWarning } from "@/components/admin/cms/useCmsEntry";
import { adminFetch, BTN_ICON, BTN_SECONDARY, FeedbackBanner, FilterTabs, INPUT, PageIntro, Spinner, useFeedback } from "@/components/admin/cms/ui";
import { productFormat } from "@/lib/catalogue/product-format";
import {
  BADGE_LABEL,
  COLLECTION_FORMAT,
  HOME_COLLECTIONS_DEFAULT,
  HOME_COLLECTIONS_MODULE,
  MAX_COLLECTION_PRODUCTS,
  homeCollectionsPayloadSchema,
  productBadges,
  selectCollectionProducts,
  type CollectionKey,
  type CollectionSettings,
  type HomeCollectionsPayload,
  type SelectableProduct,
} from "@/lib/cms/modules/home-collections";

/** Form state: the payload, with optional texts as strings ("" = not set). */
type PanelForm = Omit<CollectionSettings, "subtitle" | "formatLabel"> & { subtitle: string; formatLabel: string };
type Form = Omit<HomeCollectionsPayload, "personality" | "rollOn"> & { personality: PanelForm; rollOn: PanelForm };

interface AdminProduct extends SelectableProduct {
  status: string;
  bestseller: boolean;
  newLaunch: boolean;
  buyOneGetOne: boolean;
}

const PANEL_LABEL: Record<CollectionKey, string> = { personality: "Personality Collection", rollOn: "Roll-On Collection" };
const FORMAT_WORD: Record<CollectionKey, string> = { personality: "Perfume", rollOn: "Roll-On" };

function toForm(raw: unknown): Form {
  const parsed = homeCollectionsPayloadSchema.safeParse(raw);
  const p = parsed.success ? parsed.data : HOME_COLLECTIONS_DEFAULT;
  const panel = (s: CollectionSettings): PanelForm => ({ ...s, subtitle: s.subtitle ?? "", formatLabel: s.formatLabel ?? "" });
  return { ...p, personality: panel(p.personality), rollOn: panel(p.rollOn) };
}

type Check = { ok: true; payload: Record<string, unknown> } | { ok: false; errors: Record<string, string> };

/** Same rules as the server. Errors keyed by field path (e.g. "rollOn.viewAll.href"). */
function validate(f: Form): Check {
  const parsed = homeCollectionsPayloadSchema.safeParse(f);
  if (parsed.success) return { ok: true, payload: parsed.data as unknown as Record<string, unknown> };
  const errors: Record<string, string> = {};
  for (const i of parsed.error.issues) errors[i.path.join(".")] ??= i.message;
  return { ok: false, errors };
}

function Toggle({ label, checked, onChange, field, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; field: string; help?: string }) {
  return (
    <label className="flex items-start gap-2.5 text-[13.5px]">
      <input type="checkbox" className="mt-0.5 size-4 accent-[#161513]" checked={checked} onChange={(e) => onChange(e.target.checked)} data-field={field} />
      <span>
        <span className="font-semibold text-brand-black">{label}</span>
        {help ? <span className="mt-0.5 block text-[12px] text-brand-text/55">{help}</span> : null}
      </span>
    </label>
  );
}

function Choice<T extends string>({ title, label, value, options, onChange, help }: { title: string; label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void; help?: string }) {
  return (
    <div>
      <p className="mb-2 text-[13.5px] font-semibold text-brand-black">{title}</p>
      <FilterTabs label={label} value={value} onChange={onChange} options={options} />
      {help ? <p className="mt-1.5 text-[12px] text-brand-text/55">{help}</p> : null}
    </div>
  );
}

function BadgeChips({ p }: { p: AdminProduct }) {
  const badges = productBadges(p);
  if (!badges.length) return <span className="text-[12px] text-brand-text/45">No badges</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <span key={b} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${b === "buy-one-get-one" ? "bg-[#f6e2b3] text-[#2a2118]" : "bg-[#7a1d1d] text-white"}`}>
          {BADGE_LABEL[b]}
        </span>
      ))}
    </span>
  );
}

function ProductsCard({ k, panel, products, productsError, error, set }: { k: CollectionKey; panel: PanelForm; products: AdminProduct[] | null; productsError: string | null; error?: string; set: (patch: Partial<PanelForm>) => void }) {
  const format = COLLECTION_FORMAT[k];
  const word = FORMAT_WORD[k];
  const all = products ?? [];
  const byId = new Map(all.map((p) => [p.slug, p]));
  const eligible = all.filter((p) => p.format === format && p.status === "ACTIVE");
  const automatic = selectCollectionProducts(k, { ...panel, selection: { mode: "automatic", productIds: [] } } as CollectionSettings, eligible);
  const ids = panel.selection.productIds;
  const [adding, setAdding] = useState("");
  const addable = eligible.filter((p) => !ids.includes(p.slug)).sort((a, b) => a.name.localeCompare(b.name));
  const setIds = (productIds: string[]) => set({ selection: { mode: "manual", productIds } });
  const move = (i: number, d: -1 | 1) => {
    const next = [...ids];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setIds(next);
  };

  return (
    <Card icon={<ListChecks className="size-4.5" strokeWidth={1.5} />} title="Products" description={`Only active ${word} products can appear in this panel. Products keep their own names, sizes, prices and images (Admin → Products).`}>
      <Choice
        title="How products are chosen"
        label="Product selection"
        value={panel.selection.mode}
        onChange={(mode) => set({ selection: { mode, productIds: mode === "manual" && ids.length === 0 ? automatic.map((p) => p.slug) : ids } })}
        options={[
          { value: "automatic", label: "Automatic" },
          { value: "manual", label: "Choose and order" },
        ]}
        help={
          k === "personality"
            ? "Automatic: products placed in the Personality collection first, then every other active Perfume, by display order. New Perfumes appear automatically."
            : "Automatic: every active Roll-On, by display order. New Roll-Ons appear automatically."
        }
      />
      {productsError ? <p className="text-[13px] text-[#9a3b2b]">Products could not be loaded: {productsError}</p> : null}
      {!products && !productsError ? <Spinner label="Loading products…" /> : null}

      {products && panel.selection.mode === "automatic" ? (
        <div data-auto-list={k}>
          <p className="mb-2 text-[13px] font-semibold text-brand-black">Shown now ({Math.min(automatic.length, panel.maxProducts)})</p>
          {automatic.length === 0 ? <p className="text-[13px] text-brand-text/60">No active {word} products yet: this panel is hidden on the homepage.</p> : null}
          <ol className="space-y-1.5">
            {automatic.slice(0, panel.maxProducts).map((p, i) => (
              <li key={p.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[#eee3cc] bg-[#fffdf8] px-3 py-2 text-[13.5px]">
                <span className="w-5 text-right text-brand-text/45 tabular-nums">{i + 1}</span>
                <span className="font-semibold text-brand-black">{p.name}</span>
                <BadgeChips p={byId.get(p.slug) ?? (p as AdminProduct)} />
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {products && panel.selection.mode === "manual" ? (
        <div data-manual-list={k}>
          {error ? (
            <p className="mb-2 text-[13px] font-medium text-[#9a3b2b]" role="alert">
              {error}
            </p>
          ) : null}
          <ol className="space-y-1.5">
            {ids.map((id, i) => {
              const p = byId.get(id);
              const problem = !p ? "Deleted: not shown" : p.format !== format ? `Not a ${word}: not shown` : p.status !== "ACTIVE" ? "Inactive: not shown until it is active again" : null;
              return (
                <li key={id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-[#eee3cc] bg-[#fffdf8] px-3 py-2 text-[13.5px]" data-selected-product={id}>
                  <span className="w-5 text-right text-brand-text/45 tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-brand-black">{p?.name ?? id}</span>
                    {problem ? <span className="text-[12px] font-medium text-[#9a3b2b]">{problem}</span> : p ? <BadgeChips p={p} /> : null}
                  </span>
                  <span className="flex gap-1.5">
                    <button type="button" className={BTN_ICON} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${p?.name ?? id} up`}>
                      <ArrowUp className="size-4" />
                    </button>
                    <button type="button" className={BTN_ICON} disabled={i === ids.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${p?.name ?? id} down`}>
                      <ArrowDown className="size-4" />
                    </button>
                    <button type="button" className={BTN_ICON} onClick={() => setIds(ids.filter((x) => x !== id))} aria-label={`Remove ${p?.name ?? id} from this panel`}>
                      <Trash2 className="size-4" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <label htmlFor={`${k}-add`} className="sr-only">
              Add a {word} product
            </label>
            <select id={`${k}-add`} className={`${INPUT} h-10 max-w-sm`} value={adding} onChange={(e) => setAdding(e.target.value)} data-field={`${k}-add`}>
              <option value="">{addable.length ? `Add a ${word} product…` : `Every active ${word} is already listed`}</option>
              {addable.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={!adding || ids.length >= MAX_COLLECTION_PRODUCTS}
              onClick={() => {
                setIds([...ids, adding]);
                setAdding("");
              }}
              data-action={`${k}-add`}
            >
              <Plus className="size-4" /> Add
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${k}-max`} className="mb-2 block text-[13.5px] font-semibold text-brand-black">
            Maximum products shown
          </label>
          <input
            id={`${k}-max`}
            type="number"
            min={1}
            max={MAX_COLLECTION_PRODUCTS}
            className={`${INPUT} h-10 w-28`}
            value={panel.maxProducts}
            onChange={(e) => set({ maxProducts: Math.max(1, Math.min(MAX_COLLECTION_PRODUCTS, Math.round(Number(e.target.value) || 1))) })}
            data-field={`${k}-max`}
          />
          <p className="mt-1.5 text-[12px] text-brand-text/55">Two cards are visible at a time on desktop; the rest are reached with the arrows, dots or a swipe.</p>
        </div>
        <Choice
          title="Size shown on cards"
          label="Size shown on cards"
          value={panel.cardSize}
          onChange={(cardSize) => set({ cardSize })}
          options={[
            { value: "largest", label: "Largest size" },
            { value: "smallest", label: "Smallest size" },
          ]}
          help="Its name, price, original price and discount appear on the card. Visitors choose any size on the product page."
        />
      </div>
    </Card>
  );
}

export function HomeCollectionsEditor() {
  const cms = useCmsSingleton(HOME_COLLECTIONS_MODULE.id);
  const { feedback, setFeedback, clear } = useFeedback();
  const saved = useMemo(() => toForm(cms.entry?.draft ?? HOME_COLLECTIONS_DEFAULT), [cms.entry]);
  const [edited, setEdited] = useState<{ base: Form; form: Form } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [tab, setTab] = useState<CollectionKey>("personality");
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const form = edited && edited.base === saved ? edited.form : saved;
  const set = (patch: Partial<Form>) => setEdited({ base: saved, form: { ...form, ...patch } });
  const setPanel = (k: CollectionKey, patch: Partial<PanelForm>) => set({ [k]: { ...form[k], ...patch } } as Partial<Form>);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useUnsavedChangesWarning(dirty);

  useEffect(() => {
    adminFetch<{ items: { id: string; name: string; productTypeId?: string; status: string; collections?: string[]; displayOrder?: number; bestseller?: boolean; newLaunch?: boolean; buyOneGetOne?: boolean }[] }>("/api/admin/products?include=variants").then(
      (r) =>
        setProducts(
          r.items.map((p) => ({
            slug: p.id,
            name: p.name,
            format: productFormat(p.productTypeId),
            status: p.status,
            collections: p.collections ?? [],
            displayOrder: p.displayOrder,
            bestseller: Boolean(p.bestseller),
            newLaunch: Boolean(p.newLaunch),
            buyOneGetOne: Boolean(p.buyOneGetOne),
          })),
        ),
      (e: Error) => setProductsError(e.message),
    );
  }, []);

  const check = validate(form);
  const errors = showErrors && !check.ok ? check.errors : {};
  const err = (k: CollectionKey, path: string) => errors[`${k}.${path}`];

  const attempt = async (action: "save" | "publish") => {
    clear();
    if (!check.ok) {
      setShowErrors(true);
      const first = Object.keys(check.errors)[0] ?? "";
      const where = first.startsWith("rollOn") ? "rollOn" : first.startsWith("personality") ? "personality" : null;
      if (where) setTab(where);
      setFeedback({ tone: "error", message: `Please fix the highlighted fields${where ? ` (${PANEL_LABEL[where]})` : ""}.` });
      return;
    }
    try {
      if (action === "save") {
        await cms.saveDraft(check.payload);
        setFeedback({ tone: "success", message: "Draft saved. The website is unchanged until you publish." });
      } else {
        await cms.publish(dirty || !cms.entry ? check.payload : undefined);
        setFeedback({ tone: "success", message: "Published. The homepage collections are updated on the website." });
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
        <PageIntro eyebrow="Website" title="Homepage Collections" />
        <Spinner label="Loading the homepage collections…" />
      </div>
    );
  }
  if (cms.loadError) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Website" title="Homepage Collections" />
        <FeedbackBanner feedback={{ tone: "error", message: cms.loadError }} onDismiss={() => void cms.reload()} />
      </div>
    );
  }

  const k = tab;
  const panel = form[k];
  const tabHasErrors = (key: CollectionKey) => showErrors && !check.ok && Object.keys(check.errors).some((p) => p.startsWith(`${key}.`));

  return (
    <div className="space-y-6" data-collections-editor>
      <PageIntro
        eyebrow="Website"
        title="Homepage Collections"
        description="The Personality Collection (Perfumes) and Roll-On Collection panels on the homepage: headings, products, card details and design. Save a draft, check the preview, then publish. Deactivate removes both panels from the homepage."
      />

      <PublishBar
        entry={cms.entry}
        dirty={dirty}
        busy={cms.busy}
        sectionLabel="Homepage Collections"
        onSave={() => void attempt("save")}
        onPublish={() => void attempt("publish")}
        onUnpublish={() =>
          cms.unpublish().then(
            () => setFeedback({ tone: "success", message: "The homepage collections are now hidden on the website." }),
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
          The website currently shows the default collections below. Edit them, then publish to replace them.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs
          label="Collection"
          value={tab}
          onChange={setTab}
          options={(["personality", "rollOn"] as const).map((key) => ({ value: key, label: `${PANEL_LABEL[key]}${tabHasErrors(key) ? " (!)" : ""}` }))}
        />
        {!panel.enabled ? <span className="text-[13px] font-medium text-[#9a3b2b]">Hidden on the homepage</span> : null}
      </div>

      <Card icon={<LayoutGrid className="size-4.5" strokeWidth={1.5} />} title={PANEL_LABEL[k]} description="The heading area of this panel.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Toggle label="Show this collection" checked={panel.enabled} onChange={(enabled) => setPanel(k, { enabled })} field={`${k}-enabled`} help="Off: the panel is removed and the other panel is centred." />
          <Toggle label="Show the Luftansa wordmark" checked={panel.showWordmark} onChange={(showWordmark) => setPanel(k, { showWordmark })} field={`${k}-wordmark`} />
        </div>
        <TextField id={`${k}-heading`} label="Heading" required value={panel.heading} max={60} error={err(k, "heading")} onChange={(heading) => setPanel(k, { heading })} help="Shown in capitals." />
        <TextField id={`${k}-subtitle`} label="Subtitle" value={panel.subtitle} max={160} error={err(k, "subtitle")} onChange={(subtitle) => setPanel(k, { subtitle })} help="Optional italic line under the heading." />
        <Toggle label="Show the View All link" checked={panel.viewAll.show} onChange={(show) => setPanel(k, { viewAll: { ...panel.viewAll, show } })} field={`${k}-viewall-show`} />
        {panel.viewAll.show ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id={`${k}-viewall-label`} label="View All label" required value={panel.viewAll.label} max={30} error={err(k, "viewAll.label")} onChange={(label) => setPanel(k, { viewAll: { ...panel.viewAll, label } })} />
            <TextField
              id={`${k}-viewall-href`}
              label="View All destination"
              required
              value={panel.viewAll.href}
              max={300}
              error={err(k, "viewAll.href")}
              onChange={(href) => setPanel(k, { viewAll: { ...panel.viewAll, href } })}
              placeholder={k === "personality" ? "/perfumes" : "/roll-on"}
              help="A page on this site starting with /, or a full https:// address (opens in a new tab)."
            />
          </div>
        ) : null}
        <Choice
          title="Panel background"
          label="Panel background"
          value={panel.background}
          onChange={(background) => setPanel(k, { background })}
          options={[
            { value: "ivory", label: "Ivory" },
            { value: "cream", label: "Cream" },
            { value: "white", label: "White" },
          ]}
        />
      </Card>

      <ProductsCard k={k} panel={panel} products={products} productsError={productsError} error={err(k, "selection.productIds") ?? err(k, "selection")} set={(patch) => setPanel(k, patch)} />

      <Card icon={<Tags className="size-4.5" strokeWidth={1.5} />} title="Card details" description="What each product card in this panel shows. Values come from the product records.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Toggle label="Fragrance notes" checked={panel.showNotes} onChange={(showNotes) => setPanel(k, { showNotes })} field={`${k}-notes`} help="Up to three notes from the product." />
          <Toggle label="Detail pills" checked={panel.showAttributes} onChange={(showAttributes) => setPanel(k, { showAttributes })} field={`${k}-attributes`} help="Concentration, format label and gender." />
          <Toggle label="Offer badges" checked={panel.showBadges} onChange={(showBadges) => setPanel(k, { showBadges })} field={`${k}-badges`} help="Best Seller, New Launch, Buy 1 Get 1 Free." />
        </div>
        {panel.showAttributes ? (
          <TextField
            id={`${k}-format-label`}
            label="Format label"
            value={panel.formatLabel}
            max={30}
            error={err(k, "formatLabel")}
            onChange={(formatLabel) => setPanel(k, { formatLabel })}
            placeholder={k === "rollOn" ? "Roll-On Parfum" : "e.g. Eau de Parfum"}
            help={`Optional pill shown on every card in this panel. Leave empty for none. Only use a label that is true for every ${FORMAT_WORD[k]}.`}
          />
        ) : null}
        <p className="rounded-xl bg-[#f8f3e8] px-3.5 py-2.5 text-[12.5px] text-brand-text/75">
          Badges are set on each product: open{" "}
          <Link href="/admin/products" className="font-semibold text-brand-black underline underline-offset-2">
            Admin → Products
          </Link>
          , edit a product and tick Bestseller, New Launch or Buy 1 Get 1 Free. A product can have several badges. Prices, original prices and the discount also come from the product&apos;s sizes.
        </p>
      </Card>

      <Card icon={<Palette className="size-4.5" strokeWidth={1.5} />} title="Section design" description="Applies to both panels.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Choice
            title="Panel order"
            label="Panel order"
            value={form.order}
            onChange={(order) => set({ order })}
            options={[
              { value: "personality-first", label: "Personality first" },
              { value: "roll-on-first", label: "Roll-On first" },
            ]}
            help="Left and right on desktop, top and bottom on phones."
          />
          <Choice
            title="Product image shape"
            label="Product image shape"
            value={form.design.imageRatio}
            onChange={(imageRatio) => set({ design: { ...form.design, imageRatio } })}
            options={[
              { value: "4:5", label: "Portrait 4:5" },
              { value: "3:4", label: "Tall 3:4" },
              { value: "2:3", label: "Taller 2:3" },
            ]}
            help="Images fill the frame without distortion (some edges may be cropped)."
          />
          <Choice
            title="Badge position"
            label="Badge position"
            value={form.design.badgePosition}
            onChange={(badgePosition) => set({ design: { ...form.design, badgePosition } })}
            options={[
              { value: "top-left", label: "Top left" },
              { value: "top-right", label: "Top right" },
            ]}
          />
          <Toggle label="Gold lines beside the wordmark" checked={form.design.decorative} onChange={(decorative) => set({ design: { ...form.design, decorative } })} field="decorative" />
        </div>
        <p className="text-[12.5px] text-brand-text/60">View Details buttons are always black with white text.</p>
      </Card>

      <section className="rounded-2xl border border-[#e3d6bd] bg-white p-4 sm:p-6" aria-labelledby="collections-preview-heading">
        <h2 id="collections-preview-heading" className="font-serif text-[22px] font-semibold text-brand-black">
          Preview
        </h2>
        <div className="mt-4">
          <PreviewFrame
            title="Homepage Collections"
            draftSrc="/admin/preview/collections?version=draft"
            liveSrc="/admin/preview/collections?version=live"
            reloadKey={cms.entry ? `${cms.entry.version}` : "none"}
            frameHeight={1500}
            note={dirty ? "The preview shows the last saved draft. Save to see your latest changes." : "Exactly what the website will show, at each device's real width."}
          />
        </div>
      </section>
    </div>
  );
}
