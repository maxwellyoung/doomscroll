import type { CodeCard } from "@/types";
import type { ExtractedBlock } from "./extract";

function displayDirHint(filePath: string): string {
  const dir = filePath.split("/").slice(0, -1).join("/");
  return dir ? ` in ${dir}` : "";
}

export function generatePromptForBlock(block: ExtractedBlock): string {
  const dirHint = displayDirHint(block.filePath);

  switch (block.type) {
    case "function":
      return `Before you reveal the answer: what does ${block.name} do${dirHint}, and when would the app call it?`;
    case "type":
      return `Before you reveal the answer: what shape or contract does ${block.name} define${dirHint}?`;
    case "concept":
      return `Before you reveal the answer: how does ${block.name} organize behavior or state${dirHint}?`;
    case "pattern":
      return `Before you reveal the answer: what recurring problem is ${block.name} solving${dirHint}?`;
    case "file":
      return `Before you reveal the answer: what is the job of ${block.name}${dirHint} in the wider system?`;
  }
}

export function getCardPrompt(card: CodeCard): string {
  if (card.prompt?.trim()) return card.prompt.trim();

  const dirHint = displayDirHint(card.filePath);
  switch (card.type) {
    case "function":
      return `Before you reveal the answer: what does ${card.title} do${dirHint}, and when is it used?`;
    case "type":
      return `Before you reveal the answer: what shape or contract does ${card.title} define${dirHint}?`;
    case "concept":
      return `Before you reveal the answer: how does ${card.title} organize behavior or state${dirHint}?`;
    case "pattern":
      return `Before you reveal the answer: what recurring problem is ${card.title} solving${dirHint}?`;
    case "file":
    default:
      return `Before you reveal the answer: what is the job of ${card.title}${dirHint} in the system?`;
  }
}
