/**
 * Syntax highlighting — Georgi Gerganov efficiency.
 * No AST, no tree-sitter, no WebView. Just regex and color.
 * Good enough to make code beautiful. Small enough to ship.
 */
import React from "react";
import { Text, type TextStyle, type StyleProp } from "react-native";
import { color } from "./design";

type TokenType =
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "type"
  | "boolean"
  | "punctuation"
  | "plain";

interface Token {
  type: TokenType;
  value: string;
}

const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: color.purple,
  string: color.green,
  comment: color.textTertiary,
  number: color.amber,
  type: color.cyan,
  boolean: color.amber,
  punctuation: color.textTertiary,
  plain: color.text,
};

// Order matters — first match wins.
const RULES: [TokenType, RegExp][] = [
  ["comment", /\/\/[^\n]*/],
  ["string", /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/],
  [
    "keyword",
    /\b(?:function|const|let|var|return|if|else|switch|case|for|while|do|break|continue|new|this|typeof|instanceof|void|delete|throw|try|catch|finally|class|extends|import|export|from|default|as|async|await|yield|type|interface|enum|declare|readonly|private|protected|public|static|get|set|in|of)\b/,
  ],
  ["boolean", /\b(?:true|false|null|undefined)\b/],
  ["number", /\b\d+\.?\d*\b/],
  ["type", /\b[A-Z][a-zA-Z0-9]*(?:<[^>]*>)?\b/],
  ["punctuation", /[{}()\[\];,.:?!&|<>=+\-*/%~@#^]+/],
];

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let remaining = code;

  while (remaining.length > 0) {
    let matched = false;

    for (const [type, regex] of RULES) {
      const match = remaining.match(new RegExp(`^(${regex.source})`));
      if (match) {
        tokens.push({ type, value: match[0] });
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Accumulate plain text
      const last = tokens[tokens.length - 1];
      if (last?.type === "plain") {
        last.value += remaining[0];
      } else {
        tokens.push({ type: "plain", value: remaining[0] });
      }
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

interface Props {
  code: string;
  style?: StyleProp<TextStyle>;
}

export function SyntaxHighlight({ code, style }: Props) {
  const tokens = tokenize(code);

  return (
    <Text style={[{ fontFamily: "monospace", fontSize: 13, lineHeight: 20 }, style]}>
      {tokens.map((token, i) => (
        <Text key={i} style={{ color: TOKEN_COLORS[token.type] }}>
          {token.value}
        </Text>
      ))}
    </Text>
  );
}
