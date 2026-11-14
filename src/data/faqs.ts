/**
 * Frequently Asked Questions.
 *
 * Answers use only confirmed information (catalogue, pricing, contact details
 * and existing site content). Topics that depend on business policies not yet
 * configured in src/data/store.ts are flagged `pendingConfirmation` and direct
 * customers to Luftansa support instead of making promises. Replace those
 * answers once the policy text is confirmed.
 */
import { BOTTLE_SIZES_ML, formatInr, STANDARD_PRICES_INR } from "./products";
import { CONTACT, POLICIES } from "./store";

export interface Faq {
  id: string;
  question: string;
  answer: string;
  /** True when the full answer still needs a confirmed Luftansa policy. */
  pendingConfirmation?: boolean;
}

const sizesAndPrices = BOTTLE_SIZES_ML.map((ml) => `${ml} ml at ${formatInr(STANDARD_PRICES_INR[ml])}`).join(", ");
const contactLine = `email ${CONTACT.email} or call / WhatsApp ${CONTACT.phone}`;

export const FAQS: readonly Faq[] = [
  {
    id: "special",
    question: "What makes Luftansa fragrances special?",
    answer:
      "At Luftansa Fragrance Craft Hub, we believe every fragrance tells a story. Our collection brings together distinctive scents and thoughtful craftsmanship, with fragrances created for every mood, moment and personality.",
  },
  {
    id: "types",
    question: "What types of fragrances does Luftansa offer?",
    answer:
      "Our current range is perfume sprays, including our Personality Collection and Best Sellers such as Daily Rizz, Nonchalant, Green Flag Energy, Main Character and Deja Vu. Roll-on fragrances are coming soon. For other formats, please contact us.",
  },
  {
    id: "choose",
    question: "How do I choose the right fragrance?",
    answer:
      "Start with the mood or occasion you have in mind. Our Find Your Personality section lets you explore each signature, and Explore by Notes groups scents into citrus, woody, floral and oud families. If you would like a personal recommendation, our team is happy to help on WhatsApp.",
  },
  {
    id: "notes",
    question: "What are top, heart and base fragrance notes?",
    answer:
      "Top notes are what you smell first, right after applying. Heart (middle) notes emerge as the top notes settle and form the character of the fragrance. Base notes develop last and give the scent its depth. Each product page lists the notes we have confirmed for that fragrance.",
  },
  {
    id: "longevity",
    question: "How long does a Luftansa fragrance last?",
    answer:
      "How long a fragrance lasts varies from person to person, depending on skin type, climate, the amount applied and where it is worn. For guidance on a specific fragrance, please contact our team.",
    pendingConfirmation: true,
  },
  {
    id: "apply",
    question: "How should I apply perfume for better performance?",
    answer:
      "Apply to clean, moisturised skin and spray lightly on pulse points such as the wrists, neck and behind the ears. Let it dry naturally instead of rubbing, and store the bottle closed, away from heat and direct sunlight.",
  },
  {
    id: "sizes",
    question: "What bottle sizes are available?",
    answer: `Our perfume sprays are available in ${sizesAndPrices}. Available sizes are shown on each product page.`,
  },
  {
    id: "gifts",
    question: "Can I purchase fragrances as gifts?",
    answer:
      "Yes. Our fragrances come in elegant, luxury packaging that makes them a lovely gift. For gift-specific requests, please contact our team before ordering.",
  },
  {
    id: "order",
    question: "How can I place an order?",
    answer: `Choose your fragrance and size on its product page and tap Buy Now to send your order to us on WhatsApp. You can also ${contactLine}. Online checkout is coming soon.`,
  },
  {
    id: "payments",
    question: "What payment methods are available?",
    answer: POLICIES.payments ?? `Our payment options will be published here soon. Meanwhile, please ${contactLine} and our team will guide you.`,
    pendingConfirmation: !POLICIES.payments,
  },
  {
    id: "support",
    question: "How can I contact Luftansa customer support?",
    answer: `You can ${contactLine}. Our address is ${CONTACT.addressLines.join(" ")}`,
  },
  {
    id: "delivery-returns",
    question: "What is the delivery and return policy?",
    answer:
      [POLICIES.delivery, POLICIES.returns].filter(Boolean).join(" ") ||
      `Our delivery and return policies will be published here soon. For any questions about an order, please ${contactLine}.`,
    pendingConfirmation: !(POLICIES.delivery && POLICIES.returns),
  },
];
