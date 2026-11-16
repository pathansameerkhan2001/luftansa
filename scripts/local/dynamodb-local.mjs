/**
 * Starts DynamoDB Local (AWS's official local emulator) on 127.0.0.1:8000.
 *
 *   npm run local:db
 *
 * First run downloads the official archive from AWS into .local/dynamodb-local
 * (git-ignored). Data persists in .local/dynamodb-data. Requires Java 17+.
 * Nothing here can reach a real AWS account.
 */
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { DB_PORT, LOCAL_DIR } from "./env.mjs";

const DOWNLOAD_URL = "https://d1ni2b6xgvw0s0.cloudfront.net/v2.x/dynamodb_local_latest.zip";
const installDir = path.join(LOCAL_DIR, "dynamodb-local");
const dataDir = path.join(LOCAL_DIR, "dynamodb-data");
const jar = path.join(installDir, "DynamoDBLocal.jar");

async function install() {
  mkdirSync(installDir, { recursive: true });
  const zip = path.join(installDir, "dynamodb_local_latest.zip");
  console.log(`[local:db] Downloading DynamoDB Local from ${DOWNLOAD_URL} …`);
  const res = await fetch(DOWNLOAD_URL);
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(zip));
  // bsdtar extracts zip archives. On Windows use the system tar.exe explicitly:
  // Git Bash's GNU tar reads "E:" as a remote host and cannot read zip files.
  const tarBin = process.platform === "win32" ? path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar";
  const r = spawnSync(tarBin, ["-xf", path.basename(zip)], { cwd: installDir, stdio: "inherit" });
  if (r.status !== 0) throw new Error("Could not extract the DynamoDB Local archive");
}

if (!existsSync(jar)) await install();
mkdirSync(dataDir, { recursive: true });

console.log(`[local:db] DynamoDB Local on http://127.0.0.1:${DB_PORT} (data: ${dataDir})`);
const child = spawn(
  "java",
  [`-Djava.library.path=${path.join(installDir, "DynamoDBLocal_lib")}`, "-jar", jar, "-sharedDb", "-dbPath", dataDir, "-port", String(DB_PORT)],
  { cwd: installDir, stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
