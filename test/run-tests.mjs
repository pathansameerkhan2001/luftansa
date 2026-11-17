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
