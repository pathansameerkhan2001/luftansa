/**
 * Fragrance profiles: occasion, description and scent pyramid per product slug.
 *
 * Rules:
 * - Only confirmed information. Leave a field undefined when it has not been
 *   supplied; the UI then shows a structured "coming soon" placeholder.
 * - `source` records where each profile came from so it can be audited.
 *
 * Note images are optional and come from NOTE_IMAGES (atmospheric ingredient
 * photography, Unsplash License). A note without an image shows a neutral icon.
 */
export type NoteTier = "top" | "middle" | "base";

export interface FragranceProfile {
  perfectFor?: string;
  description?: string;
  notes?: Partial<Record<NoteTier, string>>;
  /** Where this information came from (for review). */
  source?: string;
}

export const FRAGRANCE_PROFILES: Record<string, FragranceProfile> = {
  "daily-rizz": {
    perfectFor: "Daily Wear",
    description:
      "A refreshing blend of Citrus, Musk & Amber that feels clean, energetic, and effortless. Your go-to fragrance for work, college, gym, or everyday moments.",
    notes: { top: "Citrus", middle: "Musk", base: "Amber" },
    source: "Approved Best Sellers reference design (to be confirmed by Luftansa)",
  },
  // nonchalant, green-flag-energy, main-character, deja-vu: awaiting confirmed details.
};

/**
 * Ingredient photography for fragrance notes, keyed by note name
 * (case-insensitive). Used for a note without a photo uploaded in
 * Admin → Products. Every photo shows the ingredient it is listed under;
 * free licences only (Unsplash License, Pexels License, Pixabay Content
 * License). Notes not listed here get a fragrance-family photo instead
 * (src/data/note-families.ts).
 */
const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=320&q=75&fm=jpg&fit=crop`;
const pexels = (id: number) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=320`;
const pixabay = (path: string) => `https://cdn.pixabay.com/photo/${path}`;

export const NOTE_IMAGES: Record<string, { src: string; alt: string }> = {
  citrus: { src: "https://images.unsplash.com/photo-1606926167690-07a1edafd407?w=320&q=75&fm=jpg", alt: "Halved oranges with green leaves" },
  amber: { src: "https://images.unsplash.com/photo-1764061148216-f786bcc4b353?w=320&q=75&fm=jpg", alt: "Golden amber resin on wood bark" },
  bergamot: { src: pixabay("2019/07/19/03/44/bergamot-4347906_640.jpg"), alt: "Green bergamot fruit on the branch" },
  lemon: { src: unsplash("1610126176343-3e1833a107e1"), alt: "Overlapping slices of fresh lemon" },
  lime: { src: unsplash("1581340752304-a781f821e8ce"), alt: "Slices of fresh green lime" },
  orange: { src: unsplash("1582979512210-99b6a53386f9"), alt: "A sliced orange on a white plate" },
  mandarin: { src: unsplash("1770678817191-c3f8d0c52496"), alt: "Ripe mandarins with green leaves" },
  grapefruit: { src: unsplash("1769508854136-3a600db4c2e0"), alt: "Half a ripe pink grapefruit" },
  yuzu: { src: pixabay("2019/08/15/18/46/yuzu-4408660_640.jpg"), alt: "Two yuzu fruits on the branch" },
  rose: { src: unsplash("1597826368522-9f4cb5a6ba48"), alt: "Close-up of a pink rose" },
  jasmine: { src: unsplash("1781707533179-9c296c975a04"), alt: "White jasmine flowers" },
  lavender: { src: unsplash("1528756514091-dee5ecaa3278"), alt: "Close-up of lavender flowers" },
  tuberose: { src: pexels(36676880), alt: "White tuberose flowers in bloom" },
  "orange blossom": { src: pexels(31451193), alt: "White orange blossoms among green leaves" },
  "ylang-ylang": { src: unsplash("1710260715197-d43a51dbd2fa"), alt: "Yellow ylang-ylang flower on the tree" },
  iris: { src: unsplash("1769074093874-bbdad7dfa6cb"), alt: "A purple iris flower in bloom" },
  lily: { src: unsplash("1567428051128-5f09a0200655"), alt: "White lily flowers" },
  "lily of the valley": { src: unsplash("1769371720430-3182da84e211"), alt: "Lily of the valley flowers" },
  gardenia: { src: unsplash("1775401665925-9de4c4606392"), alt: "A white gardenia flower among green leaves" },
  peony: { src: unsplash("1787163519918-ce37e9c240e9"), alt: "A pink peony in bloom" },
  magnolia: { src: unsplash("1774275987863-4209a6c6d91c"), alt: "A pink magnolia flower on a branch" },
  orchid: { src: unsplash("1775403737608-0ca8321c480e"), alt: "Close-up of a purple orchid" },
  lilac: { src: unsplash("1776363204433-9ca6948722af"), alt: "Purple lilac flowers in bloom" },
  freesia: { src: unsplash("1758960811639-c298327c5436"), alt: "Yellow freesia flowers" },
  osmanthus: { src: unsplash("1762931421951-2e5c1f9a1d75"), alt: "Orange osmanthus flowers and green leaves" },
  geranium: { src: unsplash("1754493931412-f687f01b0983"), alt: "Pink geranium flowers" },
  saffron: { src: unsplash("1760982685843-17fdca1c1bc9"), alt: "Saffron flowers with red stigmas" },
  apple: { src: unsplash("1630563451961-ac2ff27616ab"), alt: "A red apple" },
  pear: { src: unsplash("1615484477778-ca3b77940c25"), alt: "A ripe pear" },
  peach: { src: unsplash("1642372849486-f88b963cb734"), alt: "Ripe peaches, one halved" },
  plum: { src: unsplash("1564750497011-ead0ce4b9448"), alt: "Fresh purple plums with leaves" },
  cherry: { src: unsplash("1782604379105-4dcc72fb56ba"), alt: "Red cherries with water droplets" },
  fig: { src: unsplash("1633932850276-4382027c868a"), alt: "Sliced fresh figs" },
  pineapple: { src: unsplash("1788033530490-208a77c2c251"), alt: "Whole pineapple with its green crown" },
  blackcurrant: { src: unsplash("1749558160105-97f6f9d382b1"), alt: "Ripe blackcurrants on the bush" },
  raspberry: { src: unsplash("1774710025339-52bddb2fbc41"), alt: "Fresh ripe raspberries" },
  strawberry: { src: unsplash("1770325929620-711e3a6824b1"), alt: "A ripe strawberry with leaves" },
  blackberry: { src: unsplash("1774710304329-a0f8326781a0"), alt: "Fresh ripe blackberries" },
  melon: { src: unsplash("1773487742962-987ec2f20bad"), alt: "Two halves of a honeydew melon" },
  watermelon: { src: unsplash("1780865204192-003121b32d4c"), alt: "A slice of watermelon" },
  "passion fruit": { src: unsplash("1747644208239-6cf92b710129"), alt: "Half a passion fruit" },
  coconut: { src: unsplash("1560769680-ba2f3767c785"), alt: "Halved coconuts" },
  mint: { src: unsplash("1788440890059-0aba82658d9a"), alt: "Fresh mint leaves" },
  rosemary: { src: unsplash("1778425458438-4b024dc66cf0"), alt: "Fresh rosemary sprigs" },
  basil: { src: unsplash("1749655248287-d1e0acb5f8d1"), alt: "Fresh basil leaves" },
  thyme: { src: unsplash("1766395742023-c5ea3f4ceb7a"), alt: "Flowering thyme" },
  eucalyptus: { src: unsplash("1786081676718-586b275c1f57"), alt: "A sprig of eucalyptus leaves" },
  "bay leaf": { src: unsplash("1498612753354-772a30629934"), alt: "Fresh bay leaves" },
  "green tea": { src: unsplash("1763617702099-d956f3fd8324"), alt: "Dried green tea leaves" },
  tea: { src: unsplash("1563822249366-3efb23b8e0c9"), alt: "Spoons of loose-leaf tea" },
  pine: { src: unsplash("1783699374377-c47fabea8053"), alt: "A green pine branch" },
  juniper: { src: unsplash("1773341737863-ceb37f997bec"), alt: "Blue juniper berries on the branch" },
  "black pepper": { src: unsplash("1759393098862-f2e98983e2f1"), alt: "A single black peppercorn" },
  cardamom: { src: unsplash("1758657996330-095d08451cd9"), alt: "Dried cardamom pods" },
  cinnamon: { src: unsplash("1758657996518-e67bd328854e"), alt: "Cinnamon sticks" },
  clove: { src: unsplash("1701191310584-3f319e0e6c59"), alt: "Whole cloves spilling from a glass jar" },
  "star anise": { src: unsplash("1642255516075-6a9194060864"), alt: "A star anise pod" },
  ginger: { src: unsplash("1741517802684-ba07c444a5d2"), alt: "Fresh ginger root" },
  birch: { src: unsplash("1781584648187-c7513fd1aa9b"), alt: "White birch tree trunks with textured bark" },
  sandalwood: { src: unsplash("1736506159893-22cca29b8018"), alt: "Close-up of dark wood grain" },
  cedarwood: { src: unsplash("1636396279546-2294149dc46e"), alt: "Pieces of wood in a glass bowl" },
  vanilla: { src: pexels(14381803), alt: "Dried vanilla beans on white fabric" },
  coffee: { src: unsplash("1783926014847-748a8074eb38"), alt: "Dark roasted coffee beans" },
  cacao: { src: unsplash("1573710661345-610f790e1218"), alt: "Cacao pods on the tree" },
  honey: { src: unsplash("1777306086149-48c4e11e28ee"), alt: "Honeycomb filled with golden honey" },
  almond: { src: unsplash("1508779018996-601e37fa274e"), alt: "Whole almonds" },
  hazelnut: { src: unsplash("1767709383373-2e7c2e192e6d"), alt: "Roasted hazelnuts" },
  leather: { src: unsplash("1571829604981-ea159f94e5ad"), alt: "Close-up of brown leather" },
  tobacco: { src: unsplash("1758414083945-798d80875767"), alt: "Close-up of tobacco leaves" },
  cotton: { src: unsplash("1731043581723-2ee332c031b3"), alt: "Cotton flowers" },
  "sea salt": { src: unsplash("1769259362714-d442db54b706"), alt: "Coarse salt crystals" },
};

/** Other names of the same ingredient. */
const NOTE_ALIASES: Record<string, string> = {
  "bergamot orange": "bergamot",
  "sweet orange": "orange",
  "blood orange": "orange",
  tangerine: "mandarin",
  "mandarin orange": "mandarin",
  clementine: "mandarin",
  "pink grapefruit": "grapefruit",
  "damask rose": "rose",
  "turkish rose": "rose",
  "bulgarian rose": "rose",
  "rose petals": "rose",
  "jasmine sambac": "jasmine",
  sambac: "jasmine",
  neroli: "orange blossom",
  "orange flower": "orange blossom",
  "ylang ylang": "ylang-ylang",
  ylang: "ylang-ylang",
  orris: "iris",
  "orris root": "iris",
  "white lily": "lily",
  muguet: "lily of the valley",
  "green apple": "apple",
  "red apple": "apple",
  cherries: "cherry",
  "black cherry": "cherry",
  "black currant": "blackcurrant",
  cassis: "blackcurrant",
  raspberries: "raspberry",
  strawberries: "strawberry",
  blackberries: "blackberry",
  honeydew: "melon",
  passionfruit: "passion fruit",
  peppermint: "mint",
  spearmint: "mint",
  "bay leaves": "bay leaf",
  laurel: "bay leaf",
  matcha: "green tea",
  "black tea": "tea",
  "tea leaves": "tea",
  "pine needles": "pine",
  "juniper berries": "juniper",
  "juniper berry": "juniper",
  pepper: "black pepper",
  cloves: "clove",
  anise: "star anise",
  cedar: "cedarwood",
  "vanilla bean": "vanilla",
  "vanilla beans": "vanilla",
  "bourbon vanilla": "vanilla",
  "coffee bean": "coffee",
  "coffee beans": "coffee",
  cocoa: "cacao",
  almonds: "almond",
  hazelnuts: "hazelnut",
  "tobacco leaf": "tobacco",
  "cotton flower": "cotton",
  salt: "sea salt",
};

export const normaliseNoteName = (note: string) => note.trim().toLowerCase().replace(/\s+/g, " ");

export function getNoteImage(note: string) {
  const key = normaliseNoteName(note);
  return NOTE_IMAGES[key] ?? NOTE_IMAGES[NOTE_ALIASES[key] ?? ""];
}
