/**
 * Card generation — turns extracted code blocks into learning cards.
 *
 * Dan Abramov: clear mental models. Each card is self-contained.
 * Rich Harris: anti-dogma. The explanation comes from the code itself,
 * not from an AI hallucinating about what the code might do.
 */
import type { CodeCard, CardType } from "@/types";
import type { ExtractedBlock } from "./extract";

function blockTypeToCardType(type: ExtractedBlock["type"]): CardType {
  return type as CardType;
}

/** Estimate difficulty from code complexity */
function estimateDifficulty(block: ExtractedBlock): 1 | 2 | 3 {
  const { code, lineCount } = block;

  let complexity = 0;

  // Line count factor
  if (lineCount > 20) complexity += 2;
  else if (lineCount > 10) complexity += 1;

  // Nesting depth
  let maxDepth = 0;
  let depth = 0;
  for (const ch of code) {
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    maxDepth = Math.max(maxDepth, depth);
  }
  if (maxDepth > 4) complexity += 2;
  else if (maxDepth > 2) complexity += 1;

  // Generic types
  if (code.includes("<") && code.includes(">")) complexity += 1;

  // Async/await
  if (code.includes("async") || code.includes("await")) complexity += 1;

  // Recursion (function calls itself)
  if (block.type === "function") {
    const nameRegex = new RegExp(`\\b${block.name}\\(`, "g");
    const calls = code.match(nameRegex);
    if (calls && calls.length > 1) complexity += 2;
  }

  if (complexity >= 4) return 3;
  if (complexity >= 2) return 2;
  return 1;
}

/** Generate an explanation from context (JSDoc, file path, name) */
function generateExplanation(block: ExtractedBlock): string {
  // Use JSDoc if available — the author's own words
  if (block.jsDoc) return block.jsDoc;

  // Contextual explanation from file path and name
  const dir = block.filePath.split("/").slice(0, -1).join("/");
  const dirHint = dir ? ` in ${dir}` : "";

  switch (block.type) {
    case "function":
      return `Exported function${dirHint}. Read the code to understand what ${block.name} does and when you'd use it.`;
    case "type":
      return `Type definition${dirHint}. Defines the shape of ${block.name} — study the fields and their constraints.`;
    case "concept":
      return `Class${dirHint}. Encapsulates ${block.name} — look at the methods and how state is managed.`;
    case "pattern":
      return `Pattern${dirHint}. A reusable approach to a recurring problem.`;
    case "file":
      return `Key file${dirHint}. Read through to understand the module's responsibilities.`;
  }
}

/** Cap card count per repo */
const MAX_CARDS = 50;

/** Convert extracted blocks into learning cards */
export function generateCards(
  blocks: ExtractedBlock[],
  maxCards = MAX_CARDS
): CodeCard[] {
  return blocks.slice(0, maxCards).map((block, i) => ({
    id: `gen-${i}-${block.name}`,
    type: blockTypeToCardType(block.type),
    title: block.name,
    filePath: block.filePath,
    code: block.code,
    language: block.language,
    explanation: generateExplanation(block),
    difficulty: estimateDifficulty(block),
  }));
}
