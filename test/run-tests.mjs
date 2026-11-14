import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const emptyPath = path.join(__dirname, "empty.js");

const jiti = createJiti(import.meta.url, {
  alias: {
    "server-only": emptyPath,
  },
});

console.log("Loading product-db.test.ts via jiti with server-only stubbed...");
await jiti.import("./product-db.test.ts");
