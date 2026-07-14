/**
 * Eve only bundles files under each agent app root (agents/<id>/).
 * Canonical shared code lives in packages/agent-shared; this copies it into
 * agents/<id>/shared for the bundler.
 *
 * Run after editing packages/agent-shared:
 *   node scripts/sync-agent-shared.mjs
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "packages", "agent-shared");
const agentsDir = path.join(root, "agents");

const agents = readdirSync(agentsDir).filter((name) => {
  if (name.startsWith("_") || name.startsWith(".")) return false;
  return statSync(path.join(agentsDir, name)).isDirectory();
});

for (const id of agents) {
  const dest = path.join(agentsDir, id, "shared");
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, {
    recursive: true,
    filter: (p) => !p.endsWith("package.json") && !p.includes("node_modules"),
  });
  console.log(`synced ${path.relative(root, dest)}`);
}
