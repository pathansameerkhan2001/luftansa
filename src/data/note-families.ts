/**
 * Fragrance-family photography: the last fallback for a note that has neither
 * an uploaded photo (Admin → Products) nor its own ingredient photo
 * (NOTE_IMAGES). The note is matched to its family by name ("Smoked Oud" →
 * woody, "Sea Breeze" → aquatic), so the circle always shows something from
 * the same family, never another named ingredient. Notes that match no family
 * get dried perfumery botanicals. Free licences only (Unsplash License).
 */
import { NOTE_IMAGES, normaliseNoteName } from "./fragrance-profiles";

export type NoteImage = { src: string; alt: string };

const unsplash = (id: string, alt: string): NoteImage => ({ src: `https://images.unsplash.com/photo-${id}?w=320&q=75&fm=jpg&fit=crop`, alt });

export type NoteFamily = "aquatic" | "musky" | "resinous" | "mossy" | "green" | "woody" | "fruity" | "floral" | "citrus" | "spicy" | "botanical";

export const FAMILY_IMAGES: Record<NoteFamily, readonly NoteImage[]> = {
  aquatic: [unsplash("1457195740896-7f345efef228", "Calm blue sea"), unsplash("1527066236128-2ff79f7b9705", "Ripples on clear water"), unsplash("1785062811959-404fd5a36c5b", "An ocean wave breaking")],
  musky: [unsplash("1761642932833-fa22d121766b", "Soft white cotton bolls with dew"), unsplash("1705147293352-3e81c1b8ab5b", "Soft white cotton bolls in a vase")],
  resinous: [unsplash("1782192496614-d2e98e5f96e0", "A golden resin drop on tree bark"), unsplash("1790821074454-7bd7570c53d9", "Chunks of natural resin")],
  mossy: [unsplash("1708022772151-26030f4a4ba4", "Thick green moss"), unsplash("1785074163143-c0b24a5496be", "Moss growing on earth and stones")],
  green: [unsplash("1691391611977-198acc8d43b2", "A wooden bowl of fresh herbs"), unsplash("1547936785-c57315d64694", "Close-up of a green leaf")],
  woody: [unsplash("1786038607143-a3382cf01da6", "Fine wood shavings"), unsplash("1761655622268-3707c5467749", "A stack of cut wood")],
  fruity: [unsplash("1772766115480-a39cc40482dd", "A bowl of fresh berries")],
  floral: [unsplash("1771398105642-2cbcec0c8743", "A small bouquet of dried flowers"), unsplash("1770988043152-2d1d6ec3a429", "Close-up of soft flower petals")],
  citrus: [unsplash("1760108273020-87f0bc6c8ef3", "Fresh citrus fruit with green leaves"), unsplash("1611080626919-7cf5a9dbab5b", "A pile of fresh citrus fruit")],
  spicy: [unsplash("1581600140682-d4e68c8cde32", "Whole spices on a wooden surface"), unsplash("1596040033229-a9821ebd058d", "Assorted spices"), unsplash("1785107738371-cec0f2d0e6ea", "Bowls of colourful spices")],
  botanical: [unsplash("1778423618436-75f7620ebd10", "Dried rose buds and herbs in tins"), unsplash("1614378719646-ce1c2961b91c", "Dried grasses")],
};

/** Checked in this order; the first family with a matching word wins. */
const FAMILY_WORDS: readonly [NoteFamily, readonly string[]][] = [
  ["aquatic", ["sea", "ocean", "marine", "water", "aquatic", "aqua", "ozone", "ozonic", "rain", "breeze", "calone", "dew", "salt", "wave"]],
  ["musky", ["musk", "ambrette", "ambergris", "ambroxan", "powder", "powdery", "aldehyde", "aldehydes", "cashmere", "cotton", "clean", "soap", "skin", "suede", "milk", "cream", "creamy"]],
  ["resinous", ["amber", "resin", "incense", "frankincense", "olibanum", "myrrh", "benzoin", "labdanum", "cistus", "elemi", "opoponax", "styrax", "balsam", "tolu", "copal", "smoke", "smoky"]],
  ["mossy", ["moss", "oakmoss", "patchouli", "earth", "earthy", "soil", "mushroom", "truffle", "lichen", "fern", "mineral", "petrichor"]],
  ["woody", ["wood", "woods", "woody", "oud", "agarwood", "aoud", "vetiver", "guaiac", "cypress", "cedar", "sandal", "teak", "ebony", "hinoki", "bark", "papyrus", "akigalawood", "cashmeran", "oak", "birch"]],
  ["fruity", ["fruit", "fruity", "berry", "berries", "apple", "pear", "peach", "apricot", "plum", "cherry", "currant", "cassis", "fig", "melon", "mango", "lychee", "litchi", "guava", "papaya", "banana", "pomegranate", "quince", "grape", "nectarine", "kiwi", "rhubarb", "date"]],
  ["citrus", ["citrus", "bergamot", "lemon", "lime", "orange", "mandarin", "tangerine", "grapefruit", "yuzu", "citron", "clementine", "pomelo", "kumquat", "petitgrain", "zest"]],
  ["floral", ["flower", "flowers", "floral", "blossom", "petal", "petals", "rose", "jasmine", "lily", "iris", "orris", "violet", "tuberose", "ylang", "gardenia", "peony", "magnolia", "orchid", "lilac", "freesia", "osmanthus", "geranium", "lotus", "heliotrope", "mimosa", "carnation", "hyacinth", "narcissus", "honeysuckle", "frangipani", "champaca", "cyclamen", "neroli", "marigold", "chamomile", "camellia", "sakura"]],
  ["green", ["green", "leaf", "leaves", "grass", "herb", "herbs", "herbal", "mint", "basil", "sage", "thyme", "rosemary", "tea", "matcha", "galbanum", "eucalyptus", "bamboo", "lemongrass", "verbena", "juniper", "pine", "fir", "cucumber", "aloe", "ivy"]],
  ["spicy", ["spice", "spices", "spicy", "pepper", "peppercorn", "cardamom", "cinnamon", "clove", "nutmeg", "ginger", "saffron", "cumin", "anise", "coriander", "chili", "pimento", "allspice", "caraway", "mace"]],
];

/** The fragrance family of a note, from the words in its name (last word first: "Green Apple" → fruity). */
export function noteFamily(name: string): NoteFamily {
  const words = normaliseNoteName(name)
    .split(/[^a-z]+/)
    .filter(Boolean)
    .reverse();
  for (const word of words) {
    // Whole word, or the end of a compound ("rosewood" → wood, "blackberry" → berry).
    for (const [family, keys] of FAMILY_WORDS) if (keys.some((k) => word === k || (k.length >= 4 && word.endsWith(k)))) return family;
  }
  return "botanical";
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * Fills in a family photo for every note that has no image (pure). Notes
 * that already have one (uploaded or curated) keep it. Within one product
 * no photo is used twice: another photo of the same family is chosen,
 * then a botanical one, then any family photo. The choice is stable for a
 * note name, so the same note looks the same on every visit.
 */
export function withFamilyImages<N extends { name: string; image?: NoteImage }>(groups: readonly (readonly N[])[]): (N & { image: NoteImage })[][] {
  const used = new Set(groups.flatMap((g) => g.map((n) => n.image?.src).filter((s): s is string => Boolean(s))));
  const everyFamilyImage = Object.values(FAMILY_IMAGES).flat();
  return groups.map((group) =>
    group.map((note) => {
      if (note.image) return note as N & { image: NoteImage };
      const family = FAMILY_IMAGES[noteFamily(note.name)];
      const start = hash(normaliseNoteName(note.name));
      const rotate = (list: readonly NoteImage[]) => list.map((_, i) => list[(start + i) % list.length]);
      const candidates = [...rotate(family), ...rotate(FAMILY_IMAGES.botanical), ...rotate(everyFamilyImage)];
      const image = candidates.find((c) => !used.has(c.src)) ?? candidates[0];
      used.add(image.src);
      return { ...note, image };
    }),
  );
}

/** Every curated or family photo, for checks (each must be on an allowed image host). */
export const ALL_NOTE_PHOTOS: readonly NoteImage[] = [...Object.values(NOTE_IMAGES), ...Object.values(FAMILY_IMAGES).flat()];
