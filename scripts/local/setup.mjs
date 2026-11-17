/** Runs scripts/local/setup.ts with the local environment (npm run local:setup). */
import { createJiti } from "jiti";
import path from "node:path";
import { localEnv, ROOT } from "./env.mjs";

Object.assign(process.env, localEnv());
const jiti = createJiti(import.meta.url, {
  alias: { "server-only": path.join(ROOT, "test", "empty.js"), "@": path.join(ROOT, "src") },
});
const { setupLocal } = await jiti.import("./setup.ts");
await setupLocal();
