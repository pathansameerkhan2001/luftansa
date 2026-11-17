/**
 * Runs Next.js against the local stack only.
 *
 *   npm run local:dev            next dev   (http://localhost:3000)
 *   npm run local:start          next start (after a normal `npm run build`)
 *
 * Start `npm run local:db` and `npm run local:idp` first, then `npm run local:setup` once.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { APP_PORT, localEnv, ROOT } from "./env.mjs";

const mode = process.argv[2] === "start" ? "start" : "dev";
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const env = { ...process.env, ...localEnv() };
delete env.VERCEL;
delete env.VERCEL_ENV;
console.log(`[local] next ${mode} on http://localhost:${APP_PORT}: DynamoDB Local, local media, mock admin sign-in (no production access).`);
const child = spawn(process.execPath, [nextBin, mode, "-p", String(APP_PORT)], { cwd: ROOT, env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
