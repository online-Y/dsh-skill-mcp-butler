/**
 * dsh-skill-mcp-studio — dedicated state store.
 *
 * State lives outside `settings.yaml`, in a plugin-owned directory:
 *
 *   `<harness home>/skill-mcp-studio/state.json`
 *
 * (`<harness home>` = `$DSH_HOME` or `~/.dsh`). Writes are atomic (temp file
 * + rename) and serialized through a promise chain; reads fall back to the
 * empty state on missing or corrupt files.
 *
 * Migration: when the new file does not exist yet but the legacy
 * `mcp-skill-manager/state.json` from `dsh-skills-mcp-group-manager` does,
 * the first `loadSync()` imports it so groups and MCP entries carry over.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Resolve the harvest home used for plugin-owned state. */
function resolveHome(dshHome) {
  return dshHome ?? process.env.DSH_HOME ?? join(homedir(), '.dsh');
}

/** Resolve the plugin-owned state directory under the harness home. */
export function resolveStateDir(dshHome) {
  return join(resolveHome(dshHome), 'skill-mcp-studio');
}

/** Resolve the legacy state directory (dsh-skills-mcp-group-manager). */
export function resolveLegacyStateDir(dshHome) {
  return join(resolveHome(dshHome), 'mcp-skill-manager');
}

/** Normalize an untrusted parsed document into the state shape. */
export function normalizeState(raw) {
  const groups = Array.isArray(raw?.groups)
    ? raw.groups.filter((g) => g !== null && typeof g === 'object'
      && typeof g.id === 'string' && typeof g.name === 'string'
      && typeof g.enabled === 'boolean' && Array.isArray(g.skills)
      && g.skills.every((s) => typeof s === 'string'))
    : [];
  const mcp = Array.isArray(raw?.mcp)
    ? raw.mcp.filter((m) => m !== null && typeof m === 'object'
      && typeof m.serverName === 'string'
      && (m.transport === 'stdio' || m.transport === 'streamable-http')
      && typeof m.enabled === 'boolean' && typeof m.addedByUser === 'boolean')
    : [];
  return { groups, mcp };
}

/**
 * Create the state store.
 * @param options.dshHome - explicit harness home (tests pass a temp dir).
 * @param options.logger - optional `{ warn, error }` logger (defaults to console).
 * @param options.migrateFromLegacy - import `mcp-skill-manager/state.json` on first load (default true).
 */
export function createStateStore({ dshHome, logger = console, migrateFromLegacy = true } = {}) {
  const dir = resolveStateDir(dshHome);
  const file = join(dir, 'state.json');
  const legacyFile = join(resolveLegacyStateDir(dshHome), 'state.json');
  let state = { groups: [], mcp: [] };
  let writeChain = Promise.resolve();

  /**
   * Load state from disk SYNCHRONOUSLY (idempotent; safe to call once at
   * startup). `apply()` must stay synchronous — Cordis treats a
   * prototype-bearing function as a constructor and ignores its returned
   * promise, so an async apply would turn any post-await throw into an
   * unhandled rejection that crashes the whole dsh process.
   */
  function loadSync() {
    try {
      state = normalizeState(JSON.parse(readFileSync(file, 'utf8')));
      return state;
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        logger.warn?.(`skill-mcp-studio: state file unreadable (${file}): ${String(error)}; starting empty`);
      }
    }
    if (migrateFromLegacy && !existsSync(file) && existsSync(legacyFile)) {
      try {
        state = normalizeState(JSON.parse(readFileSync(legacyFile, 'utf8')));
        logger.warn?.(`skill-mcp-studio: imported legacy state from ${legacyFile}`);
        void persist();
        return state;
      } catch (error) {
        logger.warn?.(`skill-mcp-studio: legacy state unreadable (${legacyFile}): ${String(error)}`);
      }
    }
    state = { groups: [], mcp: [] };
    return state;
  }

  /** Load state from disk (async variant; kept for tests and tooling). */
  async function load() {
    try {
      const raw = await readFile(file, 'utf8');
      state = normalizeState(JSON.parse(raw));
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        logger.warn?.(`skill-mcp-studio: state file unreadable (${file}): ${String(error)}; starting empty`);
      }
      state = { groups: [], mcp: [] };
    }
    return state;
  }

  /** Current in-memory state (plain data; callers must not mutate it). */
  function get() {
    return state;
  }

  /** Merge a patch into the state and persist atomically. */
  function update(patch) {
    state = { ...state, ...patch };
    return persist();
  }

  /** Replace the whole state and persist atomically. */
  function replace(next) {
    state = normalizeState(next);
    return persist();
  }

  /** Serialized atomic write; failures never poison the chain. */
  function persist() {
    const snapshot = JSON.stringify(state, null, 2);
    writeChain = writeChain
      .then(async () => {
        await mkdir(dir, { recursive: true });
        const tmp = join(dir, `.state.${process.pid}.${Date.now()}.tmp`);
        await writeFile(tmp, snapshot, 'utf8');
        await rename(tmp, file);
      })
      .catch((error) => {
        logger.error?.(`skill-mcp-studio: state write failed (${file}): ${String(error)}`);
      });
    return writeChain;
  }

  return { load, loadSync, get, update, replace, persist, dir, file };
}
