import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";
import { resolve } from "node:path";

const buildDir = resolve(".test-build/finance-v1-1-dogecoin");
const entryPoint = resolve("src/lib/video-pipeline/premium-dynamic-finance-v1-1-pilot-cli.ts");
const bundledEntry = resolve(buildDir, "premium-dynamic-finance-v1-1-pilot-cli.mjs");

await mkdir(buildDir, { recursive: true });
try {
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    outfile: bundledEntry,
    sourcemap: "inline",
  });
  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [bundledEntry, ...process.argv.slice(2)], {
      stdio: "inherit",
      env: process.env,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`Pilot process terminated by ${signal}`));
      else resolveExit(code ?? 1);
    });
  });
  process.exitCode = Number(exitCode);
} finally {
  await rm(buildDir, { recursive: true, force: true });
}