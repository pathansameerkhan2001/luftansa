/**
 * Customer policy pages (Shipping, Returns, Privacy, Terms), each a single CMS
 * record on the existing CMS: Admin → Website → Policy Pages.
 *
 *   - Never published → the default text below.
 *   - Published       → the admin's text.
 *   - Deactivated     → the page is hidden (404) and its footer link removed.
 *
 * Content is plain text only (no markup): sections with a heading and a body.
 * In a body, a blank line starts a new paragraph and lines starting with "- "
 * form a bulleted list.
 *
 * DEFAULT TEXT RULE: the defaults state only facts already established on this
 * website (ordering on WhatsApp, nothing charged online, confirmed contact
 * details, no tracking). They make no promises about delivery times, charges,
 * refunds or legal terms. Luftansa should complete these pages in the admin
 * (see POLICY_DETAILS_NEEDED) and publish them.
 */
import { z } from "zod";
import { CONTACT, STORE_NAME } from "@/data/store";
import type { CmsModuleDefinition } from "../schemas";

export const POLICY_KEYS = ["shipping", "returns", "privacy", "terms"] as const;
export type PolicyKey = (typeof POLICY_KEYS)[number];

export const POLICY_ROUTE: Record<PolicyKey, string> = {
  shipping: "/shipping-policy",
  returns: "/return-policy",
  privacy: "/privacy-policy",
  terms: "/terms-and-conditions",
};

export const POLICY_LABEL: Record<PolicyKey, string> = {
  shipping: "Shipping Policy",
  returns: "Return Policy",
  privacy: "Privacy Policy",
  terms: "Terms and Conditions",
};

/** What Luftansa still needs to confirm before each default page is complete (shown in the admin). */
export const POLICY_DETAILS_NEEDED: Record<PolicyKey, readonly string[]> = {
  shipping: ["Where you deliver (cities, states, all India, international)", "Delivery charges and any free-delivery threshold", "Typical dispatch and delivery times", "Courier partners and whether tracking is shared", "Cash on delivery, if offered"],
  returns: ["Whether returns, exchanges or replacements are accepted, and for which reasons", "The time limit for reporting a problem", "Condition requirements (for example unopened, original packaging)", "How refunds are paid and how long they take", "Who pays return shipping"],
  privacy: ["The legal name of the business and a contact for privacy questions (if different)", "How long order and chat details are kept", "Any service providers you share order details with (for example couriers, payment providers)", "Review by your legal adviser"],
  terms: ["The legal name and address of the business (and GSTIN, if you show it)", "Accepted payment methods", "Cancellation rules", "Governing law and jurisdiction", "Review by your legal adviser"],
};

const sectionSchema = z
  .object({
    heading: z.string().trim().min(1, "Enter the section heading").max(120, "Heading must be 120 characters or fewer"),
    body: z.string().trim().min(1, "Enter the section text").max(4000, "Section text must be 4000 characters or fewer"),
  })
  .strict();
export type PolicySection = z.infer<typeof sectionSchema>;

export const policyPayloadSchema = z
  .object({
    title: z.string().trim().min(1, "Enter the page title").max(80, "Title must be 80 characters or fewer"),
    intro: z
      .string()
      .trim()
      .max(600, "Introduction must be 600 characters or fewer")
      .optional()
      .transform((v) => (v ? v : undefined)),
    /** "YYYY-MM-DD", shown as "Last updated". Optional. */
    lastUpdated: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => v === undefined || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Use a valid date"),
    sections: z.array(sectionSchema).min(1, "Add at least one section").max(20, "Use 20 sections or fewer"),
  })
  .strict();
// Input type: optional fields may be omitted (parsed payloads satisfy it too).
export type PolicyPayload = z.input<typeof policyPayloadSchema>;

function policyModule(key: PolicyKey) {
  return {
    id: `policy-${key}`,
    label: POLICY_LABEL[key],
    kind: "singleton",
    payload: policyPayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
  } as const satisfies CmsModuleDefinition;
}

export const POLICY_MODULES: Record<PolicyKey, CmsModuleDefinition> = {
  shipping: policyModule("shipping"),
  returns: policyModule("returns"),
  privacy: policyModule("privacy"),
  terms: policyModule("terms"),
};

const contactLine = `WhatsApp or call ${CONTACT.phone}, or email ${CONTACT.email}`;
const orderingParagraph = `Orders are placed on WhatsApp. When you choose a fragrance, size and quantity and tap Order on WhatsApp, a message with your order details opens in WhatsApp, addressed to our team at ${CONTACT.phone}. Nothing is charged on this website.`;

export const POLICY_DEFAULTS: Record<PolicyKey, PolicyPayload> = {
  shipping: {
    title: "Shipping Policy",
    intro: `How delivery works for orders placed with ${STORE_NAME}.`,
    sections: [
      { heading: "How orders are placed", body: orderingParagraph },
      {
        heading: "Delivery details for your order",
        body: "Before your order is processed, our team confirms the following with you on WhatsApp:\n- that your fragrance and size are available\n- your delivery address\n- payment\n- delivery charges, if any, and the expected delivery time",
      },
      { heading: "Questions about a delivery", body: `For any question about a delivery, please ${contactLine}. Please mention your name and the fragrance you ordered.` },
    ],
  },
  returns: {
    title: "Return Policy",
    intro: "What to do if something is not right with your order.",
    sections: [
      {
        heading: "If something is wrong with your order",
        body: `If your order arrives damaged, incomplete or different from what you ordered, please contact us as soon as possible: ${contactLine}.\n\nPlease include:\n- your name and the fragrance you ordered\n- photographs of the product and its packaging`,
      },
      { heading: "Before returning a product", body: "Please contact our team before sending any product back, so we can tell you how to proceed." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro: `How ${STORE_NAME} handles information on this website.`,
    sections: [
      {
        heading: "What this website collects",
        body: "You can browse and order without creating an account. This website has no customer sign-in, does not take payments and does not use advertising or analytics trackers. It does not set cookies for shoppers.\n\nLike any website, our hosting provider processes technical information such as your IP address and browser type to deliver pages securely.",
      },
      {
        heading: "When you contact us or order",
        body: "When you order or contact us on WhatsApp, by phone or by email, we receive the details you choose to share, such as your name, phone number, delivery address and order. We use them to reply to you and to process your order.\n\nMessages sent on WhatsApp are also subject to WhatsApp's own privacy policy.",
      },
      { heading: "Questions", body: `For any question about your information, please ${contactLine}.` },
    ],
  },
  terms: {
    title: "Terms and Conditions",
    intro: `The terms for using this website and ordering from ${STORE_NAME}.`,
    sections: [
      { heading: "Ordering", body: `${orderingParagraph}\n\nOur team confirms availability, payment and delivery details with you on WhatsApp before your order is processed.` },
      { heading: "Prices", body: "Prices are shown in Indian Rupees (INR). The price of your order is confirmed with you on WhatsApp before your order is processed." },
      { heading: "Website content", body: `The Luftansa name, logo, photographs and text on this website belong to ${STORE_NAME} and may not be reused without permission.` },
      { heading: "Contact", body: `For any question about these terms, please ${contactLine}. Our address is ${CONTACT.addressLines.join(" ")}` },
    ],
  },
};

/* ------------------------------------------------------------ rendering --- */

export type PolicyBlock = { kind: "p"; text: string } | { kind: "ul"; items: string[] };

/** Plain-text body → paragraphs and bulleted lists (pure; never markup). */
export function toPolicyBlocks(body: string): PolicyBlock[] {
  const blocks: PolicyBlock[] = [];
  for (const chunk of body.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    let para: string[] = [];
    let list: string[] = [];
    const flushPara = () => {
      if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
      para = [];
    };
    const flushList = () => {
      if (list.length) blocks.push({ kind: "ul", items: list });
      list = [];
    };
    for (const raw of chunk.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const bullet = /^[-•*]\s+(.*)$/.exec(line);
      if (bullet) {
        flushPara();
        list.push(bullet[1]);
      } else {
        flushList();
        para.push(line);
      }
    }
    flushPara();
    flushList();
  }
  return blocks;
}

export interface PolicyView {
  key: PolicyKey;
  title: string;
  intro?: string;
  lastUpdated?: string;
  sections: { heading: string; blocks: PolicyBlock[] }[];
}

export function toPolicyView(key: PolicyKey, p: PolicyPayload): PolicyView {
  return {
    key,
    title: p.title,
    intro: p.intro,
    lastUpdated: p.lastUpdated,
    sections: p.sections.map((s) => ({ heading: s.heading, blocks: toPolicyBlocks(s.body) })),
  };
}

/**
 * What the storefront shows (pure). Deactivated → null (page hidden). The
 * default is used until something is published, while the database is
 * unavailable, and if the stored content is no longer valid.
 */
export function resolvePolicy(key: PolicyKey, result: { source: "cms" | "fallback"; items: readonly { payload: unknown }[] }): PolicyView | null {
  if (result.source === "cms" && result.items.length === 0) return null;
  const parsed = policyPayloadSchema.safeParse(result.items[0]?.payload);
  return toPolicyView(key, parsed.success ? parsed.data : POLICY_DEFAULTS[key]);
}

export function isPolicyKey(v: string): v is PolicyKey {
  return (POLICY_KEYS as readonly string[]).includes(v);
}
