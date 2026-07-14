import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Resolve monorepo `data/memory` so memory survives restarts and works whether
 * eve's cwd is the host root or `agents/<id>`.
 */
export function resolveMemoryDir() {
  if (process.env.EVE_MEMORY_DIR) {
    return path.resolve(process.env.EVE_MEMORY_DIR);
  }

  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const marker = path.join(dir, "lib", "agents", "registry.ts");
    const agentsDir = path.join(dir, "agents");
    if (existsSync(marker) && existsSync(agentsDir)) {
      return path.join(dir, "data", "memory");
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return path.join(process.cwd(), "data", "memory");
}

function filePath(agentId) {
  const safe = agentId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(resolveMemoryDir(), `${safe}.json`);
}

async function ensureDir() {
  await mkdir(resolveMemoryDir(), { recursive: true });
}

function empty(agentId) {
  return {
    agentId,
    summary: "",
    entries: {},
    updatedAt: new Date().toISOString(),
  };
}

export async function loadMemory(agentId) {
  await ensureDir();
  const fp = filePath(agentId);
  if (!existsSync(fp)) return empty(agentId);
  try {
    const raw = await readFile(fp, "utf8");
    const parsed = JSON.parse(raw);
    return {
      agentId,
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      entries:
        parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return empty(agentId);
  }
}

export async function saveMemory(file) {
  await ensureDir();
  const next = {
    ...file,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(filePath(file.agentId), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function remember(agentId, input) {
  const mem = await loadMemory(agentId);
  const entry = {
    key: input.key,
    value: input.value,
    kind: input.kind,
    updatedAt: new Date().toISOString(),
  };
  mem.entries[input.key] = entry;
  await saveMemory(mem);
  return {
    stored: entry,
    total: Object.keys(mem.entries).length,
    path: filePath(agentId),
  };
}

export async function recall(agentId, opts = {}) {
  const mem = await loadMemory(agentId);
  if (opts.key) {
    const entry = mem.entries[opts.key];
    return {
      found: Boolean(entry),
      entry: entry ?? null,
      summary: mem.summary,
      path: filePath(agentId),
    };
  }
  const entries = Object.values(mem.entries).filter((e) =>
    opts.kind ? e.kind === opts.kind : true,
  );
  return {
    summary: mem.summary,
    count: entries.length,
    entries,
    path: filePath(agentId),
  };
}

export async function forget(agentId, opts) {
  const mem = await loadMemory(agentId);
  if (opts.clearAll) {
    await saveMemory(empty(agentId));
    return { cleared: true, remaining: 0, path: filePath(agentId) };
  }
  if (!opts.key) {
    return {
      error: "Provide key, or set clearAll=true.",
      remaining: Object.keys(mem.entries).length,
    };
  }
  if (!(opts.key in mem.entries)) {
    return {
      found: false,
      key: opts.key,
      remaining: Object.keys(mem.entries).length,
    };
  }
  delete mem.entries[opts.key];
  await saveMemory(mem);
  return {
    found: true,
    forgotten: opts.key,
    remaining: Object.keys(mem.entries).length,
    path: filePath(agentId),
  };
}

export async function updateSummary(agentId, summary) {
  const mem = await loadMemory(agentId);
  mem.summary = summary;
  await saveMemory(mem);
  return { summary: mem.summary, path: filePath(agentId) };
}
