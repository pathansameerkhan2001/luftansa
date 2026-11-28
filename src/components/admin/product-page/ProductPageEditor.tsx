"use client";

/**
 * Admin: optional information sections on every product page, on the existing
 * CMS. Switching a section off only stops it being displayed: product
 * descriptions (Admin → Products) and the store FAQs (/faqs) are kept as they are.
 */
import { LayoutList } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@/components/admin/cms/FormFields";
import { PublishBar } from "@/components/admin/cms/PublishBar";
import { useCmsSingleton, useUnsavedChangesWarning } from "@/components/admin/cms/useCmsEntry";
import { FeedbackBanner, PageIntro, Spinner, useFeedback } from "@/components/admin/cms/ui";
import { PRODUCT_PAGE_DEFAULT, PRODUCT_PAGE_MODULE, productPagePayloadSchema, type ProductPagePayload } from "@/lib/cms/modules/product-page";

const OPTIONS: { key: keyof ProductPagePayload; label: string; help: string }[] = [
  { key: "showDescription", label: "Description", help: "Each product's description from Admin → Products. Hidden: the description is kept and still used for search engines." },
  { key: "showFaq", label: "Frequently Asked Questions", help: "The store FAQs relevant to products. Hidden: the FAQs are kept and remain on the FAQs page." },
];

const ALWAYS = ["Fragrance Notes", "Details", "How to Use & Care"];

export function ProductPageEditor() {
  const cms = useCmsSingleton(PRODUCT_PAGE_MODULE.id);
  const { feedback, setFeedback, clear } = useFeedback();
  const saved = useMemo(() => {
    const parsed = productPagePayloadSchema.safeParse(cms.entry?.draft);
    return parsed.success ? parsed.data : PRODUCT_PAGE_DEFAULT;
  }, [cms.entry]);
  const [edited, setEdited] = useState<{ base: ProductPagePayload; form: ProductPagePayload } | null>(null);
  const form = edited && edited.base === saved ? edited.form : saved;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useUnsavedChangesWarning(dirty);

  const attempt = async (action: "save" | "publish") => {
    clear();
    const payload = form as unknown as Record<string, unknown>;
    try {
      if (action === "save") {
        await cms.saveDraft(payload);
        setFeedback({ tone: "success", message: "Draft saved. Product pages are unchanged until you publish." });
      } else {
        await cms.publish(dirty || !cms.entry ? payload : undefined);
        setFeedback({ tone: "success", message: "Published. Every product page uses these settings." });
      }
      setEdited(null);
    } catch (e) {
      setFeedback({ tone: "error", message: (e as Error).message });
    }
  };

  if (cms.loading && !cms.entry) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Website" title="Product Page Sections" />
        <Spinner label="Loading the settings…" />
      </div>
    );
  }
  if (cms.loadError) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Website" title="Product Page Sections" />
        <FeedbackBanner feedback={{ tone: "error", message: cms.loadError }} onDismiss={() => void cms.reload()} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-product-page-editor>
      <PageIntro
        eyebrow="Website"
        title="Product Page Sections"
        description="Choose which optional information sections every product page shows. Hiding a section never deletes its content. Deactivate returns to the default (both hidden)."
      />
      <PublishBar
        entry={cms.entry}
        dirty={dirty}
        busy={cms.busy}
        sectionLabel="Product Page Sections"
        onSave={() => void attempt("save")}
        onPublish={() => void attempt("publish")}
        onUnpublish={() =>
          cms.unpublish().then(
            () => setFeedback({ tone: "success", message: "Product pages use the default: Description and FAQ hidden." }),
            (e: Error) => setFeedback({ tone: "error", message: e.message }),
          )
        }
        onDiscard={() => {
          setEdited(null);
          clear();
        }}
      />
      <FeedbackBanner feedback={feedback} onDismiss={clear} />

      <Card icon={<LayoutList className="size-4.5" strokeWidth={1.5} />} title="Optional sections" description={`Always shown: ${ALWAYS.join(", ")} (when the product has that information).`}>
        <ul className="space-y-2">
          {OPTIONS.map((o) => (
            <li key={o.key} className="rounded-xl border border-[#eee3cc] bg-[#fffdf8] px-3 py-2.5">
              <label className="flex items-start gap-3">
                <input type="checkbox" className="mt-0.5 size-4 accent-[#161513]" checked={form[o.key]} onChange={(e) => setEdited({ base: saved, form: { ...form, [o.key]: e.target.checked } })} data-field={o.key} />
                <span>
                  <span className="block text-[14px] font-semibold text-brand-black">Show {o.label}</span>
                  <span className="block text-[12.5px] text-brand-text/60">{o.help}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
