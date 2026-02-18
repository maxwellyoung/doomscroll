/**
 * Repo ingestion pipeline — the full flow.
 *
 * repo URL → GitHub API → file contents → extract blocks → rank → generate cards
 *
 * Evan Bacon: it just works. One function, one result.
 */
import type { CodeCard } from "@/types";
import {
  parseRepoInput,
  fetchRepo,
  fetchTree,
  filterCodeFiles,
  fetchFiles,
  type RepoMeta,
} from "./github";
import { extractBlocks, rankBlocks } from "./extract";
import { generateCards } from "./generate";

export interface IngestResult {
  meta: RepoMeta;
  cards: CodeCard[];
}

export type IngestStatus =
  | { phase: "parsing" }
  | { phase: "fetching"; message: string }
  | { phase: "extracting"; message: string }
  | { phase: "generating"; message: string }
  | { phase: "done"; result: IngestResult }
  | { phase: "error"; message: string };

export async function ingestRepo(
  input: string,
  onStatus: (status: IngestStatus) => void
): Promise<IngestResult> {
  // 1. Parse input
  onStatus({ phase: "parsing" });
  const parsed = parseRepoInput(input);
  if (!parsed) throw new Error("Invalid repo format. Use owner/repo or a GitHub URL.");

  const { owner, repo } = parsed;

  // 2. Fetch repo metadata
  onStatus({ phase: "fetching", message: `Loading ${owner}/${repo}...` });
  const meta = await fetchRepo(owner, repo);

  // 3. Fetch file tree
  onStatus({ phase: "fetching", message: "Scanning file tree..." });
  const tree = await fetchTree(owner, repo, meta.defaultBranch);
  const codeFiles = filterCodeFiles(tree);

  if (codeFiles.length === 0) {
    throw new Error("No supported code files found in this repo.");
  }

  // 4. Fetch file contents
  onStatus({
    phase: "fetching",
    message: `Reading ${Math.min(codeFiles.length, 40)} files...`,
  });
  const files = await fetchFiles(
    owner,
    repo,
    codeFiles.map((f) => f.path)
  );

  // 5. Extract code blocks
  onStatus({ phase: "extracting", message: "Finding interesting code..." });
  const allBlocks = files.flatMap((f) => extractBlocks(f));
  const ranked = rankBlocks(allBlocks);

  if (ranked.length === 0) {
    throw new Error("Couldn't extract any learnable code blocks.");
  }

  // 6. Generate cards
  onStatus({
    phase: "generating",
    message: `Creating ${Math.min(ranked.length, 50)} cards...`,
  });
  const cards = generateCards(ranked);

  const result = { meta, cards };
  onStatus({ phase: "done", result });
  return result;
}
