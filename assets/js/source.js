// Where the page reads its content from.
//
// Everything on this site is a file in the git repository. `site.config.json`
// decides whether the browser reads those files from the copy deployed next to
// this page ("local") or straight from the repository on GitHub ("github").
// In github mode a commit to the content branch changes the live page with no
// rebuild and no deploy.
//
// Query overrides, useful for previewing a branch before it is merged:
//   ?source=github          read from the repo named in site.config.json
//   ?source=local           read the deployed copy
//   ?branch=new-members     read a different branch
//   ?repo=owner/name        read a different repository
//   ?fresh=1                bypass the session cache

const CONFIG_FILE = "site.config.json";

const FALLBACK = {
  source: { mode: "local", local: { base: "content" }, github: { path: "content" } },
  repo: { host: "github.com", owner: "", name: "", branch: "main" },
  cache: { ttlSeconds: 300 },
};

export async function createSource() {
  let config = FALLBACK;
  try {
    const res = await fetch(`${CONFIG_FILE}?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) config = merge(FALLBACK, await res.json());
  } catch {
    // Keep the fallback: a missing site.config.json just means "local".
  }

  const q = new URLSearchParams(location.search);
  const repo = { ...config.repo };
  if (q.get("repo") && q.get("repo").includes("/")) {
    const [owner, name] = q.get("repo").split("/");
    repo.owner = owner;
    repo.name = name;
  }
  if (q.get("branch")) repo.branch = q.get("branch");

  const wanted = q.get("source") || config.source.mode || "local";
  const canGithub = Boolean(repo.owner && repo.name);
  const mode = wanted === "github" && canGithub ? "github" : "local";
  const degraded = wanted === "github" && !canGithub;

  const contentPath = trim(mode === "github" ? config.source.github?.path : config.source.local?.base) || "content";
  const ttl = q.get("fresh") ? 0 : Number(config.cache?.ttlSeconds ?? 300);

  return {
    mode,
    degraded,
    repo,
    contentPath,

    /** Absolute (or page-relative) URL of a file inside the content directory. */
    url(file) {
      const path = `${contentPath}/${trim(file)}`;
      if (mode === "github") {
        return `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${repo.branch}/${path}`;
      }
      return path;
    },

    /** A link a lab member can click to edit that file on GitHub. */
    editUrl(file) {
      if (!repo.owner || !repo.name) return "";
      const path = `${contentPath}/${trim(file)}`;
      return `https://${repo.host || "github.com"}/${repo.owner}/${repo.name}/edit/${repo.branch}/${path}`;
    },

    repoUrl() {
      if (!repo.owner || !repo.name) return "";
      return `https://${repo.host || "github.com"}/${repo.owner}/${repo.name}`;
    },

    async json(file) {
      const text = await this.text(file);
      try {
        return JSON.parse(text);
      } catch (err) {
        throw new Error(`${contentPath}/${file} is not valid JSON — ${err.message}`);
      }
    },

    async text(file) {
      const href = this.url(file);
      const hit = readCache(href, ttl);
      if (hit !== null) return hit;
      let res;
      try {
        res = await fetch(href, { cache: ttl ? "default" : "no-store" });
      } catch (err) {
        throw new Error(`Could not reach ${href} — ${err.message}`);
      }
      if (!res.ok) throw new Error(`${href} returned ${res.status} ${res.statusText}`);
      const text = await res.text();
      writeCache(href, text);
      return text;
    },

    describe(lang) {
      if (mode === "github") {
        return lang === "en"
          ? `Content read from <b>${repo.owner}/${repo.name}</b> <code>${repo.branch}</code>`
          : `內容來源：<b>${repo.owner}/${repo.name}</b> <code>${repo.branch}</code>`;
      }
      return lang === "en"
        ? `Content read from <b><code>${contentPath}/</code></b> in this checkout`
        : `內容來源：本機檔案 <b><code>${contentPath}/</code></b>`;
    },
  };
}

function trim(p) {
  return String(p ?? "").replace(/^\/+|\/+$/g, "");
}

function merge(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra || {})) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) ? merge(base[k] || {}, v) : v;
  }
  return out;
}

function readCache(key, ttl) {
  if (!ttl) return null;
  try {
    const raw = sessionStorage.getItem(`lab:${key}`);
    if (!raw) return null;
    const { at, body } = JSON.parse(raw);
    if (Date.now() - at > ttl * 1000) return null;
    return body;
  } catch {
    return null;
  }
}

function writeCache(key, body) {
  try {
    sessionStorage.setItem(`lab:${key}`, JSON.stringify({ at: Date.now(), body }));
  } catch {
    // Private windows and full quotas are fine — the page just refetches.
  }
}
