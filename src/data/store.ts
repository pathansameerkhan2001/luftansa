/**
 * Store-wide settings: contact details, social profiles and customer policies.
 *
 * Rules:
 * - Only confirmed information. Anything left `undefined` is treated as
 *   "pending confirmation": the UI never invents it and shows neutral copy.
 * - Contact details below were supplied by Luftansa.
 */

export const STORE_NAME = "Luftansa Fragrance Craft Hub";

export const CONTACT = {
  email: "luftansafragrancecrafthub@gmail.com",
  /** Display format. */
  phone: "+91 80747 90546",
  /** E.164 digits without "+", for tel: and wa.me links. */
  phoneDigits: "918074790546",
  addressLines: [
    "8/166-3, Opp. Bajaj Two Wheeler Showroom,",
    "Inside Prestige Industries Gate,",
    "Almaspet, Kadapa,",
    "Andhra Pradesh, India – 516001.",
  ],
} as const;

export const telHref = `tel:+${CONTACT.phoneDigits}`;
export const mailHref = `mailto:${CONTACT.email}`;

/** WhatsApp chat link, optionally with a prefilled message. */
export function whatsappHref(message?: string): string {
  const base = `https://wa.me/${CONTACT.phoneDigits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Social profiles. Leave undefined until the real URL is confirmed. */
export const SOCIAL_LINKS: {
  instagram?: string;
  facebook?: string;
  youtube?: string;
} = {};

/**
 * Customer policies, written exactly as Luftansa confirms them.
 * Undefined = pending confirmation (badges and FAQs show neutral copy).
 */
export const POLICIES: {
  /** e.g. delivery coverage, charges, free-delivery threshold, timelines. */
  delivery?: string;
  /** e.g. accepted payment methods / gateway. */
  payments?: string;
  /** e.g. return / exchange eligibility and window. */
  returns?: string;
} = {};

/**
 * Buy Now behaviour while there is no online checkout: open WhatsApp with a
 * prefilled order message to the confirmed store number. Set to false to fall
 * back to a "coming soon" notice instead.
 */
export const BUY_NOW_VIA_WHATSAPP = true;
