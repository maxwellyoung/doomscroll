/**
 * Code extraction engine — Sindre Sorhus severe minimalism.
 *
 * No AST. No tree-sitter. Regex that finds the interesting parts.
 * Good enough for learning. Small enough to run on a phone.
 *
 * Extracts: exported functions, types, interfaces, classes, components.
 * Captures: the code block, the name, the file path, the JSDoc comment.
 */
import type { FileContent } from "./github";

export type BlockType = "function" | "type" | "concept" | "pattern" | "file";

export interface ExtractedBlock {
  name: string;
  type: BlockType;
  code: string;
  filePath: string;
  language: string;
  jsDoc: string | null;
  lineCount: number;
}

/** Extract a balanced brace block starting from a position */
function extractBraceBlock(source: string, startIdx: number): string | null {
  let depth = 0;
  let foundOpen = false;
  let i = startIdx;

  while (i < source.length) {
    const ch = source[i];
    if (ch === "{") {
      depth++;
      foundOpen = true;
    } else if (ch === "}") {
      depth--;
      if (foundOpen && depth === 0) {
        return source.slice(startIdx, i + 1);
      }
    }
    // Skip strings
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") i++;
        i++;
      }
    }
    i++;
  }
  return null;
}

/** Find the JSDoc comment before a given position */
function findJsDoc(source: string, pos: number): string | null {
  const before = source.slice(Math.max(0, pos - 500), pos).trimEnd();
  const match = before.match(/\/\*\*\s*([\s\S]*?)\s*\*\/\s*$/);
  if (!match) return null;
  return match[1]
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)
    .join(" ");
}

/** Detect language from file extension */
function detectLanguage(path: string): string {
  const ext = path.split(".").pop() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    swift: "swift",
    kt: "kotlin",
  };
  return map[ext] ?? "text";
}

/** Main extraction — finds interesting code blocks in a file */
export function extractBlocks(file: FileContent): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  const src = file.content;
  const lang = detectLanguage(file.path);

  // Pattern: exported function
  const fnRegex =
    /export\s+(async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)/g;
  let match;
  while ((match = fnRegex.exec(src)) !== null) {
    const name = match[2];
    const jsDoc = findJsDoc(src, match.index);
    const block = extractBraceBlock(src, match.index);
    if (block && block.split("\n").length <= 40) {
      blocks.push({
        name,
        type: "function",
        code: block,
        filePath: file.path,
        language: lang,
        jsDoc,
        lineCount: block.split("\n").length,
      });
    }
  }

  // Pattern: arrow function export
  const arrowRegex =
    /export\s+const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g;
  while ((match = arrowRegex.exec(src)) !== null) {
    const name = match[1];
    const jsDoc = findJsDoc(src, match.index);
    // Try to get the full expression (until next export or EOF)
    const rest = src.slice(match.index);
    const endMatch = rest.match(
      /\n\nexport\s|;\n\n|\nconst\s|\nfunction\s|\nclass\s/
    );
    const end = endMatch
      ? match.index + (endMatch.index ?? rest.length)
      : match.index + Math.min(rest.length, 1000);
    const code = src.slice(match.index, end).trim();
    if (code.split("\n").length <= 40) {
      blocks.push({
        name,
        type: "function",
        code,
        filePath: file.path,
        language: lang,
        jsDoc,
        lineCount: code.split("\n").length,
      });
    }
  }

  // Pattern: type/interface export
  const typeRegex = /export\s+(type|interface)\s+(\w+)/g;
  while ((match = typeRegex.exec(src)) !== null) {
    const name = match[2];
    const kind = match[1];
    const jsDoc = findJsDoc(src, match.index);

    let code: string;
    if (kind === "interface") {
      const block = extractBraceBlock(src, match.index);
      code = block ?? src.slice(match.index, match.index + 200);
    } else {
      // Type alias — check if it's a braced type or a simple union/alias
      const rest = src.slice(match.index);
      const semi = rest.indexOf(";");
      const eq = rest.indexOf("=");
      const braceAfterEq = eq >= 0 ? rest.indexOf("{", eq) : -1;

      if (braceAfterEq >= 0 && (semi < 0 || braceAfterEq < semi)) {
        // Braced type like `type Foo = { bar: string }`
        const block = extractBraceBlock(src, match.index);
        code = block ?? src.slice(match.index, match.index + 200);
      } else {
        // Simple type alias — find the semicolon
        code = src.slice(match.index, match.index + (semi > 0 ? semi + 1 : 200));
      }
    }

    if (code.split("\n").length <= 30) {
      blocks.push({
        name,
        type: "type",
        code: code.trim(),
        filePath: file.path,
        language: lang,
        jsDoc,
        lineCount: code.split("\n").length,
      });
    }
  }

  // Pattern: class export
  const classRegex = /export\s+(?:default\s+)?class\s+(\w+)/g;
  while ((match = classRegex.exec(src)) !== null) {
    const name = match[1];
    const jsDoc = findJsDoc(src, match.index);
    const block = extractBraceBlock(src, match.index);
    if (block && block.split("\n").length <= 50) {
      blocks.push({
        name,
        type: "concept",
        code: block,
        filePath: file.path,
        language: lang,
        jsDoc,
        lineCount: block.split("\n").length,
      });
    }
  }

  // If no exports found, treat the whole file as a card (if small enough)
  if (blocks.length === 0 && src.split("\n").length <= 40) {
    const fileName = file.path.split("/").pop() ?? file.path;
    blocks.push({
      name: fileName,
      type: "file",
      code: src.trim(),
      filePath: file.path,
      language: lang,
      jsDoc: null,
      lineCount: src.split("\n").length,
    });
  }

  return blocks;
}

/** Deduplicate and rank blocks by interestingness */
export function rankBlocks(blocks: ExtractedBlock[]): ExtractedBlock[] {
  // Remove duplicates by name
  const seen = new Set<string>();
  const unique = blocks.filter((b) => {
    const key = `${b.name}:${b.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Score: prefer mid-length code, named exports, functions
  return unique
    .map((b) => {
      let score = 0;
      // Sweet spot: 8-25 lines
      if (b.lineCount >= 8 && b.lineCount <= 25) score += 10;
      else if (b.lineCount >= 4 && b.lineCount <= 35) score += 5;
      // Has JSDoc = documented = important
      if (b.jsDoc) score += 5;
      // Functions are most learnable
      if (b.type === "function") score += 3;
      if (b.type === "type") score += 2;
      return { block: b, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.block);
}
