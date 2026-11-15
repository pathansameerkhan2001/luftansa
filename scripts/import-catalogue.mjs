// Launcher: runs scripts/import-catalogue.ts with jiti, stubbing "server-only"
// (the same approach as test/run-tests.mjs). Dry run unless --apply is passed.
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, {
  alias: { "server-only": path.join(root, "test", "empty.js") },
});
await jiti.import("./import-catalogue.ts");
