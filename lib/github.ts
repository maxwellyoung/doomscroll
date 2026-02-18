/**
 * GitHub API client — Georgi Gerganov efficiency.
 * No SDK, no GraphQL, no auth for public repos.
 * Just fetch, parse, return.
 */

const API = "https://api.github.com";

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
}

export interface FileContent {
  path: string;
  content: string;
}

/** Parse "owner/repo" from various input formats */
export function parseRepoInput(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\/+$/, "");

  // Full URL: https://github.com/owner/repo
  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)/
  );
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };

  // Short form: owner/repo
  const shortMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] };

  return null;
}

/** Fetch repo metadata */
export async function fetchRepo(
  owner: string,
  repo: string
): Promise<RepoMeta> {
  const res = await fetch(`${API}/repos/${owner}/${repo}`);
  if (!res.ok) throw new Error(`Repo not found: ${owner}/${repo}`);
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
  branch: string
): Promise<TreeEntry[]> {
  const res = await fetch(
    `${API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
  );
  if (!res.ok) throw new Error("Failed to fetch repo tree");
  const data = await res.json();
  return (data.tree as any[])
    .filter((e) => e.type === "blob")
    .map((e) => ({ path: e.path, type: e.type, size: e.size }));
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
export function filterCodeFiles(tree: TreeEntry[]): TreeEntry[] {
  return tree.filter((entry) => {
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
  });
}

/** Fetch file contents (max ~60 files to stay within rate limits) */
export async function fetchFiles(
  owner: string,
  repo: string,
  paths: string[],
  maxFiles = 40
): Promise<FileContent[]> {
  const selected = paths.slice(0, maxFiles);
  const results: FileContent[] = [];

  // Fetch in batches of 8 to avoid rate limits
  for (let i = 0; i < selected.length; i += 8) {
    const batch = selected.slice(i, i + 8);
    const fetched = await Promise.all(
      batch.map(async (path) => {
        try {
          const res = await fetch(
            `${API}/repos/${owner}/${repo}/contents/${path}`
          );
          if (!res.ok) return null;
          const data = await res.json();
          if (data.encoding !== "base64") return null;
          // Decode base64 — handle UTF-8 multi-byte characters
          const raw = atob(data.content.replace(/\n/g, ""));
          const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
          const content = new TextDecoder().decode(bytes);
          return { path, content };
        } catch {
          return null;
        }
      })
    );
    results.push(...fetched.filter((f): f is FileContent => f !== null));
  }

  return results;
}
