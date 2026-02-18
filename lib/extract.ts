/**
 * Code extraction engine — Sindre Sorhus severe minimalism.
 *
 * No AST. No tree-sitter. Regex that finds the interesting parts.
 * Good enough for learning. Small enough to run on a phone.
 *
 * Supports: TypeScript/JavaScript, Python, Rust, Go, Swift, Kotlin.
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

/** Extract a Python block by indentation */
function extractIndentBlock(
  source: string,
  startIdx: number
): string | null {
  const lines = source.slice(startIdx).split("\n");
  if (lines.length < 2) return null;

  const result = [lines[0]];
  const baseIndent = lines[1]?.match(/^(\s*)/)?.[1]?.length ?? 0;
  if (baseIndent === 0) return lines[0];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") {
      result.push(line);
      continue;
    }
    const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
    if (indent < baseIndent) break;
    result.push(line);
  }

  return result.join("\n").trimEnd();
}

/** Find the JSDoc/docstring comment before a given position */
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

/** Find Python docstring after a def/class line */
function findPyDocstring(source: string, defEnd: number): string | null {
  const after = source.slice(defEnd, defEnd + 500);
  const match = after.match(/^\s*"""([\s\S]*?)"""/);
  if (!match) return null;
  return match[1].trim();
}

/** Find Rust doc comment (/// lines) before a position */
function findRustDoc(source: string, pos: number): string | null {
  const before = source.slice(Math.max(0, pos - 500), pos).trimEnd();
  const lines = before.split("\n").reverse();
  const docLines: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*\/\/\/\s?(.*)/);
    if (m) docLines.unshift(m[1]);
    else break;
  }
  return docLines.length > 0 ? docLines.join(" ") : null;
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

// ─── TypeScript/JavaScript extraction ────────────────────

function extractTS(
  src: string,
  file: FileContent,
  lang: string
): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  let match;

  // Exported functions
  const fnRegex =
    /export\s+(async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)/g;
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

  // Arrow function exports
  const arrowRegex =
    /export\s+const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g;
  while ((match = arrowRegex.exec(src)) !== null) {
    const name = match[1];
    const jsDoc = findJsDoc(src, match.index);
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

  // React components — export function/const that returns JSX
  const componentRegex =
    /export\s+(?:default\s+)?(?:function|const)\s+([A-Z]\w+)/g;
  while ((match = componentRegex.exec(src)) !== null) {
    const name = match[1];
    // Skip if we already captured this as a regular function
    if (blocks.some((b) => b.name === name)) continue;
    const jsDoc = findJsDoc(src, match.index);
    const block = extractBraceBlock(src, match.index);
    if (block && block.includes("<") && block.split("\n").length <= 50) {
      blocks.push({
        name,
        type: "pattern",
        code: block,
        filePath: file.path,
        language: lang,
        jsDoc,
        lineCount: block.split("\n").length,
      });
    }
  }

  // Type/interface exports
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
      const rest = src.slice(match.index);
      const semi = rest.indexOf(";");
      const eq = rest.indexOf("=");
      const braceAfterEq = eq >= 0 ? rest.indexOf("{", eq) : -1;

      if (braceAfterEq >= 0 && (semi < 0 || braceAfterEq < semi)) {
        const block = extractBraceBlock(src, match.index);
        code = block ?? src.slice(match.index, match.index + 200);
      } else {
        code = src.slice(
          match.index,
          match.index + (semi > 0 ? semi + 1 : 200)
        );
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

  // Class exports
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

  return blocks;
}

// ─── Python extraction ───────────────────────────────────

function extractPython(
  src: string,
  file: FileContent
): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  let match;

  // def functions (top-level, not method)
  const defRegex = /^(async\s+)?def\s+(\w+)\s*\([^)]*\)/gm;
  while ((match = defRegex.exec(src)) !== null) {
    // Skip private/dunder unless it's __init__
    const name = match[2];
    if (name.startsWith("_") && name !== "__init__") continue;

    const block = extractIndentBlock(src, match.index);
    if (!block || block.split("\n").length > 40) continue;

    const colonIdx = src.indexOf(":", match.index + match[0].length);
    const docstring = colonIdx >= 0 ? findPyDocstring(src, colonIdx + 1) : null;

    blocks.push({
      name,
      type: "function",
      code: block,
      filePath: file.path,
      language: "python",
      jsDoc: docstring,
      lineCount: block.split("\n").length,
    });
  }

  // class definitions
  const classRegex = /^class\s+(\w+)(?:\([^)]*\))?:/gm;
  while ((match = classRegex.exec(src)) !== null) {
    const name = match[1];
    const block = extractIndentBlock(src, match.index);
    if (!block || block.split("\n").length > 50) continue;

    const colonIdx = src.indexOf(":", match.index + match[0].length);
    const docstring = colonIdx >= 0 ? findPyDocstring(src, colonIdx + 1) : null;

    blocks.push({
      name,
      type: "concept",
      code: block,
      filePath: file.path,
      language: "python",
      jsDoc: docstring,
      lineCount: block.split("\n").length,
    });
  }

  return blocks;
}

// ─── Rust extraction ─────────────────────────────────────

function extractRust(
  src: string,
  file: FileContent
): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  let match;

  // pub fn
  const fnRegex = /pub\s+(async\s+)?fn\s+(\w+)/g;
  while ((match = fnRegex.exec(src)) !== null) {
    const name = match[2];
    const doc = findRustDoc(src, match.index);
    const block = extractBraceBlock(src, match.index);
    if (block && block.split("\n").length <= 40) {
      blocks.push({
        name,
        type: "function",
        code: block,
        filePath: file.path,
        language: "rust",
        jsDoc: doc,
        lineCount: block.split("\n").length,
      });
    }
  }

  // pub struct
  const structRegex = /pub\s+struct\s+(\w+)/g;
  while ((match = structRegex.exec(src)) !== null) {
    const name = match[1];
    const doc = findRustDoc(src, match.index);
    const block = extractBraceBlock(src, match.index);
    if (block && block.split("\n").length <= 30) {
      blocks.push({
        name,
        type: "type",
        code: block,
        filePath: file.path,
        language: "rust",
        jsDoc: doc,
        lineCount: block.split("\n").length,
      });
    }
  }

  // pub enum
  const enumRegex = /pub\s+enum\s+(\w+)/g;
  while ((match = enumRegex.exec(src)) !== null) {
    const name = match[1];
    const doc = findRustDoc(src, match.index);
    const block = extractBraceBlock(src, match.index);
    if (block && block.split("\n").length <= 30) {
      blocks.push({
        name,
        type: "type",
        code: block,
        filePath: file.path,
        language: "rust",
        jsDoc: doc,
        lineCount: block.split("\n").length,
      });
    }
  }

  // impl blocks
  const implRegex = /impl(?:<[^>]*>)?\s+(\w+)/g;
  while ((match = implRegex.exec(src)) !== null) {
    const name = match[1];
    const block = extractBraceBlock(src, match.index);
    if (block && block.split("\n").length <= 50) {
      blocks.push({
        name: `impl ${name}`,
        type: "concept",
        code: block,
        filePath: file.path,
        language: "rust",
        jsDoc: findRustDoc(src, match.index),
        lineCount: block.split("\n").length,
      });
    }
  }

  return blocks;
}

// ─── Go extraction ───────────────────────────────────────

function extractGo(
  src: string,
  file: FileContent
): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  let match;

  // Exported functions (PascalCase)
  const fnRegex = /func\s+(\([^)]+\)\s+)?([A-Z]\w+)\s*\([^)]*\)/g;
  while ((match = fnRegex.exec(src)) !== null) {
    const name = match[2];
    const block = extractBraceBlock(src, match.index);
    if (block && block.split("\n").length <= 40) {
      // Go uses // comments for docs
      const before = src.slice(Math.max(0, match.index - 300), match.index);
      const docLines: string[] = [];
      for (const line of before.trimEnd().split("\n").reverse()) {
        const m = line.match(/^\s*\/\/\s?(.*)/);
        if (m) docLines.unshift(m[1]);
        else break;
      }
      blocks.push({
        name,
        type: "function",
        code: block,
        filePath: file.path,
        language: "go",
        jsDoc: docLines.length > 0 ? docLines.join(" ") : null,
        lineCount: block.split("\n").length,
      });
    }
  }

  // type struct
  const structRegex = /type\s+([A-Z]\w+)\s+struct/g;
  while ((match = structRegex.exec(src)) !== null) {
    const name = match[1];
    const block = extractBraceBlock(src, match.index);
    if (block && block.split("\n").length <= 30) {
      blocks.push({
        name,
        type: "type",
        code: block,
        filePath: file.path,
        language: "go",
        jsDoc: null,
        lineCount: block.split("\n").length,
      });
    }
  }

  // type interface
  const ifaceRegex = /type\s+([A-Z]\w+)\s+interface/g;
  while ((match = ifaceRegex.exec(src)) !== null) {
    const name = match[1];
    const block = extractBraceBlock(src, match.index);
    if (block && block.split("\n").length <= 30) {
      blocks.push({
        name,
        type: "type",
        code: block,
        filePath: file.path,
        language: "go",
        jsDoc: null,
        lineCount: block.split("\n").length,
      });
    }
  }

  return blocks;
}

// ─── Swift extraction ────────────────────────────────────

function extractSwift(
  src: string,
  file: FileContent
): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  let match;

  // public/open func
  const fnRegex = /(?:public|open)\s+(?:static\s+)?func\s+(\w+)/g;
  while ((match = fnRegex.exec(src)) !== null) {
    const name = match[1];
    const block = extractBraceBlock(src, match.index);
    if (block && block.split("\n").length <= 40) {
      blocks.push({
        name,
        type: "function",
        code: block,
        filePath: file.path,
        language: "swift",
        jsDoc: null,
        lineCount: block.split("\n").length,
      });
    }
  }

  // struct/class/enum/protocol
  const typeRegex =
    /(?:public\s+)?(?:struct|class|enum|protocol)\s+(\w+)/g;
  while ((match = typeRegex.exec(src)) !== null) {
    const name = match[1];
    const block = extractBraceBlock(src, match.index);
    if (block && block.split("\n").length <= 50) {
      blocks.push({
        name,
        type: src.includes("protocol") ? "type" : "concept",
        code: block,
        filePath: file.path,
        language: "swift",
        jsDoc: null,
        lineCount: block.split("\n").length,
      });
    }
  }

  return blocks;
}

// ─── Main extraction ─────────────────────────────────────

/** Main extraction — finds interesting code blocks in a file */
export function extractBlocks(file: FileContent): ExtractedBlock[] {
  const lang = detectLanguage(file.path);
  const src = file.content;

  let blocks: ExtractedBlock[];

  switch (lang) {
    case "python":
      blocks = extractPython(src, file);
      break;
    case "rust":
      blocks = extractRust(src, file);
      break;
    case "go":
      blocks = extractGo(src, file);
      break;
    case "swift":
      blocks = extractSwift(src, file);
      break;
    default:
      blocks = extractTS(src, file, lang);
  }

  // If nothing found, treat the whole file as a card (if small enough)
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
