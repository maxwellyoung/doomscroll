/**
 * GitHub API client — Georgi Gerganov efficiency.
 * No SDK, no GraphQL, no auth for public repos.
 * Just fetch, parse, return.
 */
import { getGitHubToken } from "./github-auth";

const API = "https://api.github.com";

export interface ParsedRepoInput {
  owner: string;
  repo: string;
  ref?: string;
  scopePath?: string;
}

export interface RepoMeta {
  name: string;
  fullName: string;
  description: string | null;
  stars: number;
  language: string | null;
  defaultBranch: string;
}

export interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
  sha: string;
}

export interface FileContent {
  path: string;
  content: string;
}

async function fetchGitHub(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const token = await getGitHubToken();
  const headers = new Headers(init?.headers);

  headers.set("Accept", "application/vnd.github+json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${API}${path}`, {
    ...init,
    headers,
  });
}

async function parseGitHubError(res: Response): Promise<Error> {
  let message = `GitHub request failed (${res.status})`;

  try {
    const data = await res.json();
    if (typeof data?.message === "string" && data.message.trim()) {
      message = data.message;
    }
  } catch {
    // Ignore JSON parse failures and fall back to status-based messaging.
  }

  if (res.status === 401) {
    return new Error("GitHub token rejected. Update it and try again.");
  }

  if (res.status === 403 && message.toLowerCase().includes("rate limit")) {
    return new Error(
      "GitHub rate limit hit. Add a token or wait before trying again."
    );
  }

  if (res.status === 404) {
    return new Error(
      "Repo or file not found. For private repos, connect a GitHub token first."
    );
  }

  return new Error(message);
}

function normalizeScopePath(scopePath?: string | null): string | undefined {
  if (!scopePath) return undefined;
  const trimmed = scopePath.trim().replace(/^\/+|\/+$/g, "");
  return trimmed || undefined;
}

export function formatRepoSessionName(
  fullName: string,
  scopePath?: string
): string {
  const normalizedScope = normalizeScopePath(scopePath);
  return normalizedScope ? `${fullName}#${normalizedScope}` : fullName;
}

function scoreCodeFile(path: string): number {
  let score = 0;

  if (path.includes("/app/")) score += 100;
  if (path.includes("/src/")) score += 90;
  if (path.includes("/components/")) score += 80;
  if (path.includes("/screens/")) score += 78;
  if (path.includes("/hooks/")) score += 76;
  if (path.includes("/providers/")) score += 74;
  if (path.includes("/stores/")) score += 72;
  if (path.includes("/lib/")) score += 68;
  if (path.includes("/types/")) score += 52;

  if (path.endsWith("/index.tsx") || path.endsWith("/index.ts")) score += 24;
  if (path.endsWith("/_layout.tsx")) score += 26;

  if (path.includes("/ios/")) score -= 60;
  if (path.includes("/android/")) score -= 60;
  if (path.includes("/scripts/")) score -= 35;
  if (path.includes(".config.")) score -= 25;
  if (path.includes("/assets/")) score -= 45;
  if (path.includes("/logos/")) score -= 30;
  if (path.includes("/icons/")) score -= 24;
  if (path.includes("/generated/")) score -= 30;
  if (path.includes("/constants/")) score -= 18;

  const depth = path.split("/").length;
  score -= depth;

  return score;
}

/** Parse "owner/repo" from various input formats */
export function parseRepoInput(input: string): ParsedRepoInput | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const [baseInput, rawScopeFromHash] = trimmed.split("#", 2);
  const hashScope = normalizeScopePath(rawScopeFromHash);
  const normalizedBaseInput = baseInput.replace(/\/+$/, "");

  // Full URL: https://github.com/owner/repo
  const urlMatch = normalizedBaseInput.match(
    /^(?:https?:\/\/)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/tree\/([^/?#]+)(?:\/([^?#]+))?)?$/
  );
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      ref: urlMatch[3] || undefined,
      scopePath: hashScope ?? normalizeScopePath(urlMatch[4]),
    };
  }

  // Short form: owner/repo
  const shortMatch = normalizedBaseInput.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
      scopePath: hashScope,
    };
  }

  return null;
}

/** Fetch repo metadata */
export async function fetchRepo(
  owner: string,
  repo: string
): Promise<RepoMeta> {
  const res = await fetchGitHub(`/repos/${owner}/${repo}`);
  if (!res.ok) throw await parseGitHubError(res);
  const data = await res.json();
  return {
    name: data.name,
    fullName: data.full_name,
    description: data.description,
    stars: data.stargazers_count,
    language: data.language,
    defaultBranch: data.default_branch,
  };
}

/** Fetch the full file tree */
export async function fetchTree(
  owner: string,
  repo: string,
  ref: string
): Promise<TreeEntry[]> {
  const res = await fetchGitHub(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`
  );
  if (!res.ok) throw await parseGitHubError(res);
  const data = await res.json();
  if (data.truncated) throw new Error("GitHub returned an incomplete file tree. Try a smaller repository.");
  if (!Array.isArray(data.tree)) throw new Error("GitHub did not return a valid file tree.");
  const files = data.tree.filter((e: TreeEntry) => e.type === "blob");
  if (files.some((e: TreeEntry) => typeof e.path !== "string" || !/^[a-f0-9]{40}$/.test(e.sha))) {
    throw new Error("GitHub returned file entries without a valid source identity.");
  }
  return files.map((e: TreeEntry) => ({ path: e.path, type: e.type, size: e.size, sha: e.sha }));
}

/** Supported file extensions for code extraction */
const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".rs",
  ".go",
  ".swift",
  ".kt",
]);

/** Filter tree to interesting code files */
export function filterCodeFiles(
  tree: TreeEntry[],
  scopePath?: string
): TreeEntry[] {
  const normalizedScope = normalizeScopePath(scopePath);

  return tree
    .filter((entry) => {
      if (
        normalizedScope &&
        entry.path !== normalizedScope &&
        !entry.path.startsWith(`${normalizedScope}/`)
      ) {
        return false;
      }

      const ext = "." + entry.path.split(".").pop();
      if (!CODE_EXTENSIONS.has(ext)) return false;
      // Skip tests, configs, generated files
      if (entry.path.includes("__tests__")) return false;
      if (entry.path.includes(".test.")) return false;
      if (entry.path.includes(".spec.")) return false;
      if (entry.path.includes("node_modules")) return false;
      if (entry.path.includes(".d.ts")) return false;
      if (entry.path.includes("dist/")) return false;
      if (entry.path.includes("build/")) return false;
      // Skip very large files
      if (entry.size && entry.size > 50000) return false;
      return true;
    })
    .sort((a, b) => {
      const scoreDelta = scoreCodeFile(b.path) - scoreCodeFile(a.path);
      if (scoreDelta !== 0) return scoreDelta;

      const sizeA = a.size ?? 0;
      const sizeB = b.size ?? 0;
      if (sizeA !== sizeB) return sizeA - sizeB;

      return a.path.localeCompare(b.path);
    });
}

/** Read immutable blobs from the pinned tree, never a moving branch or download URL. */
export async function fetchFiles(
  owner: string,
  repo: string,
  files: TreeEntry[],
  maxFiles = 40
): Promise<FileContent[]> {
  const selected = files.slice(0, maxFiles);
  const results: FileContent[] = [];

  // Fetch in batches of 8 to avoid rate limits
  for (let i = 0; i < selected.length; i += 8) {
    const batch = selected.slice(i, i + 8);
    const fetched = await Promise.all(
      batch.map(async ({ path, sha }) => {
        try {
          const res = await fetchGitHub(
            `/repos/${owner}/${repo}/git/blobs/${sha}`
          );
          if (!res.ok) throw await parseGitHubError(res);
          const data = await res.json();
          if (data.sha !== sha) throw new Error("GitHub returned a different source file than the pinned tree.");
          if (data.encoding !== "base64" || typeof data.content !== "string") throw new Error(`Cannot read ${path}.`);
          // Decode base64 — handle UTF-8 multi-byte characters
          const raw = atob(data.content.replace(/\n/g, ""));
          const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
          if (bytes.length > 50_000) throw new Error("Source file exceeds this import's size limit.");
          // Replacing invalid bytes could show code that differs from the source link.
          const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          return { path, content };
        } catch (error) {
          throw new Error(`Could not read ${path}: ${error instanceof Error ? error.message : "request failed"}`);
        }
      })
    );
    results.push(...fetched.filter((f): f is FileContent => f !== null));
  }

  return results;
}

/** Resolve a moving branch once so the tree, files, and links share one snapshot. */
export async function resolveCommit(owner: string, repo: string, ref: string): Promise<string> {
  const res = await fetchGitHub(`/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`);
  if (!res.ok) throw await parseGitHubError(res);
  const data = await res.json();
  if (typeof data.sha !== "string" || !/^[a-f0-9]{40}$/.test(data.sha)) {
    throw new Error("GitHub did not return a valid source revision.");
  }
  return data.sha;
}
