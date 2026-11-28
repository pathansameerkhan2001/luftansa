import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const emptyPath = path.join(__dirname, "empty.js");

const jiti = createJiti(import.meta.url, {
  alias: {
    "server-only": emptyPath,
    "@": path.join(__dirname, "..", "src"),
  },
});

console.log("Loading product-db.test.ts via jiti with server-only stubbed...");
await jiti.import("./product-db.test.ts");

console.log("\nLoading storefront-bridge.test.ts via jiti...");
await jiti.import("./storefront-bridge.test.ts");

console.log("\nLoading upload-workflow.test.ts via jiti...");
await jiti.import("./upload-workflow.test.ts");

console.log("\nLoading dynamic-product-management.test.ts via jiti...");
await jiti.import("./dynamic-product-management.test.ts");

console.log("\nLoading catalogue-sync.test.ts via jiti...");
await jiti.import("./catalogue-sync.test.ts");

console.log("\nLoading product-experience.test.ts via jiti...");
await jiti.import("./product-experience.test.ts");

console.log("\nLoading cms-foundation.test.ts via jiti...");
await jiti.import("./cms-foundation.test.ts");

console.log("\nLoading homepage-cms.test.ts via jiti...");
await jiti.import("./homepage-cms.test.ts");

console.log("\nLoading announcement-bar.test.ts via jiti...");
await jiti.import("./announcement-bar.test.ts");

console.log("\nLoading preview-isolation.test.ts via jiti...");
await jiti.import("./preview-isolation.test.ts");

console.log("\nLoading excel-import.test.ts via jiti...");
await jiti.import("./excel-import.test.ts");

console.log("\nLoading product-sections.test.ts via jiti...");
await jiti.import("./product-sections.test.ts");

console.log("\nLoading reels.test.ts via jiti...");
await jiti.import("./reels.test.ts");

console.log("\nLoading brand-story.test.ts via jiti...");
await jiti.import("./brand-story.test.ts");

console.log("\nLoading home-collections.test.ts via jiti...");
await jiti.import("./home-collections.test.ts");

console.log("\nLoading trust-tags.test.ts via jiti...");
await jiti.import("./trust-tags.test.ts");

console.log("\nLoading our-story.test.ts via jiti...");
await jiti.import("./our-story.test.ts");

console.log("\nLoading site-polish.test.ts via jiti...");
await jiti.import("./site-polish.test.ts");

console.log("\nLoading collections-nav.test.ts via jiti...");
await jiti.import("./collections-nav.test.ts");

console.log("\nLoading fragrance-notes.test.ts via jiti...");
await jiti.import("./fragrance-notes.test.ts");
