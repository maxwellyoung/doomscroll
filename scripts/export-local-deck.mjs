#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const SUPPORTED_EXTENSIONS = new Set([
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

const SKIP_DIRS = new Set([
  ".git",
  ".expo",
  ".next",
  ".turbo",
  ".vscode",
  "android",
  "build",
  "coverage",
  "dist",
  "ios",
  "node_modules",
  "Pods",
  "tmp",
]);

const DEFAULTS = {
  maxFiles: 60,
  maxCards: 80,
  maxFileSize: 50_000,
};

const JS_LIKE_LANGUAGES = new Set(["typescript", "javascript"]);
const IMPORT_RESOLUTION_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

function parseArgs(argv) {
  const args = [...argv];
  const positional = [];
  const options = {
    scope: "",
    out: "",
    maxFiles: DEFAULTS.maxFiles,
    maxCards: DEFAULTS.maxCards,
  };

  while (args.length > 0) {
    const token = args.shift();
    if (!token) break;

    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const name = token.slice(2);
    const value = args.shift();

    switch (name) {
      case "scope":
        options.scope = value || "";
        break;
      case "out":
        options.out = value || "";
        break;
      case "max-files":
        options.maxFiles = Math.max(1, Number(value) || DEFAULTS.maxFiles);
        break;
      case "max-cards":
        options.maxCards = Math.max(1, Number(value) || DEFAULTS.maxCards);
        break;
      default:
        throw new Error(`Unknown flag: --${name}`);
    }
  }

  if (!positional[0]) {
    throw new Error(
      "Usage: npm run deck:export-local -- /path/to/repo [--scope apps/mobile] [--out ./deck.json]"
    );
  }

  return {
    repoPath: positional[0],
    ...options,
  };
}

function normalizeScopePath(scopePath = "") {
  return scopePath.trim().replace(/^\/+|\/+$/g, "");
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".swift": "swift",
    ".kt": "kotlin",
  };
  return map[ext] || "text";
}

function scoreCodeFile(filePath) {
  let score = 0;

  if (filePath.includes("/app/")) score += 100;
  if (filePath.includes("/src/")) score += 90;
  if (filePath.includes("/components/")) score += 80;
  if (filePath.includes("/screens/")) score += 78;
  if (filePath.includes("/hooks/")) score += 76;
  if (filePath.includes("/providers/")) score += 74;
  if (filePath.includes("/stores/")) score += 72;
  if (filePath.includes("/lib/")) score += 68;
  if (filePath.includes("/types/")) score += 52;

  if (filePath.endsWith("/index.tsx") || filePath.endsWith("/index.ts")) {
    score += 24;
  }
  if (filePath.endsWith("/_layout.tsx")) score += 26;

  if (filePath.includes("/scripts/")) score -= 35;
  if (filePath.includes(".config.")) score -= 25;
  if (filePath.includes("/assets/")) score -= 45;
  if (filePath.includes("/logos/")) score -= 30;
  if (filePath.includes("/icons/")) score -= 24;
  if (filePath.includes("/generated/")) score -= 30;
  if (filePath.includes("/constants/")) score -= 18;

  score -= filePath.split("/").length;
  return score;
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wildcardToRegExp(pattern) {
  return new RegExp(`^${escapeRegExp(pattern).replace(/\\\*/g, "(.+)")}$`);
}

function toRepoPath(absolutePath, repoRoot) {
  return toPosix(path.relative(repoRoot, absolutePath));
}

function describePath(absolutePath, repoRoot, scopeRoot) {
  const normalizedAbsolute = path.normalize(absolutePath);
  const normalizedScope = path.normalize(scopeRoot);
  const normalizedRepo = path.normalize(repoRoot);
  const inScope =
    normalizedAbsolute === normalizedScope ||
    normalizedAbsolute.startsWith(`${normalizedScope}${path.sep}`);
  const inRepo =
    normalizedAbsolute === normalizedRepo ||
    normalizedAbsolute.startsWith(`${normalizedRepo}${path.sep}`);

  return {
    absolutePath: normalizedAbsolute,
    repoRelativePath: inRepo ? toRepoPath(normalizedAbsolute, repoRoot) : null,
    scopeRelativePath: inScope
      ? toPosix(path.relative(scopeRoot, normalizedAbsolute))
      : null,
    scopeKind: inScope ? "scope" : inRepo ? "repo" : "external",
  };
}

function displayPath(info) {
  return info.scopeRelativePath || info.repoRelativePath || info.absolutePath;
}

function classifyPath(info) {
  const normalized = displayPath(info);
  if (
    normalized === "app/_layout.tsx" ||
    normalized.endsWith("/_layout.tsx")
  ) {
    return "layout";
  }
  if (normalized.startsWith("app/")) return "route";
  if (normalized.startsWith("src/providers/")) return "provider";
  if (normalized.startsWith("src/stores/")) return "store";
  if (normalized.startsWith("src/hooks/")) return "hook";
  if (normalized.startsWith("src/components/")) return "component";
  if (normalized.startsWith("src/ui/")) return "ui";
  if (normalized.startsWith("src/lib/")) return "lib";
  if (normalized.startsWith("src/theme")) return "theme";
  if (normalized.startsWith("src/config/")) return "config";
  if (normalized.startsWith("src/contexts/")) return "context";
  if (normalized.startsWith("src/features/")) return "feature";
  if (normalized.startsWith("packages/")) return "package";
  return "module";
}

function extractImportSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /\bimport\s+(?:type\s+)?[\s\S]*?\sfrom\s+["']([^"']+)["']/g,
    /\bexport\s+(?:type\s+)?[\s\S]*?\sfrom\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s+["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const specifier = match[1]?.trim();
      if (!specifier) continue;
      specifiers.add(specifier);
    }
  }

  return [...specifiers];
}

async function loadImportResolver(repoRoot, scopeRoot) {
  const candidates = [
    path.join(scopeRoot, "tsconfig.json"),
    path.join(scopeRoot, "jsconfig.json"),
    path.join(repoRoot, "tsconfig.json"),
    path.join(repoRoot, "jsconfig.json"),
  ];

  const configs = [];
  const seen = new Set();

  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (!(await exists(candidate))) continue;

    try {
      const raw = await fs.readFile(candidate, "utf8");
      const parsed = JSON.parse(raw);
      const compilerOptions = parsed.compilerOptions || {};
      const configDir = path.dirname(candidate);
      const baseUrl = path.resolve(configDir, compilerOptions.baseUrl || ".");
      const paths = compilerOptions.paths || {};
      const rules = Object.entries(paths).flatMap(([pattern, targets]) => {
        const normalizedTargets = Array.isArray(targets) ? targets : [targets];
        return [
          {
            pattern,
            regex: wildcardToRegExp(pattern),
            targets: normalizedTargets,
            baseUrl,
          },
        ];
      });

      configs.push({
        configPath: candidate,
        baseUrl,
        rules,
      });
    } catch {
      // Ignore malformed config and continue with best-effort import tracing.
    }
  }

  const baseDirs = [...new Set([scopeRoot, repoRoot, ...configs.map((config) => config.baseUrl)])];
  return { configs, baseDirs };
}

function mapAliasTarget(pattern, target, match) {
  if (!pattern.includes("*")) return target;
  const captured = match[1] || "";
  return target.replace(/\*/g, captured);
}

async function resolveCandidateBase(candidateBase, cache) {
  const normalizedBase = path.normalize(candidateBase);
  if (cache.has(normalizedBase)) {
    return cache.get(normalizedBase);
  }

  const variants = [];
  const ext = path.extname(normalizedBase);

  if (IMPORT_RESOLUTION_EXTENSIONS.includes(ext)) {
    variants.push(normalizedBase);
  } else {
    for (const extension of IMPORT_RESOLUTION_EXTENSIONS) {
      variants.push(`${normalizedBase}${extension}`);
    }
  }

  for (const extension of IMPORT_RESOLUTION_EXTENSIONS) {
    variants.push(path.join(normalizedBase, `index${extension}`));
  }

  const uniqueVariants = [...new Set(variants)];
  for (const variant of uniqueVariants) {
    if (await exists(variant)) {
      cache.set(normalizedBase, variant);
      return variant;
    }
  }

  cache.set(normalizedBase, null);
  return null;
}

async function resolveImportTarget(
  specifier,
  importerAbsolutePath,
  resolver,
  repoRoot,
  scopeRoot,
  cache
) {
  const resolutionKey = `${importerAbsolutePath}::${specifier}`;
  if (cache.has(resolutionKey)) {
    return cache.get(resolutionKey);
  }

  const candidates = [];
  const importerDir = path.dirname(importerAbsolutePath);

  if (specifier.startsWith(".")) {
    candidates.push(path.resolve(importerDir, specifier));
  } else {
    for (const config of resolver.configs) {
      for (const rule of config.rules) {
        const match = specifier.match(rule.regex);
        if (!match) continue;
        for (const target of rule.targets) {
          const mapped = mapAliasTarget(rule.pattern, target, match);
          candidates.push(path.resolve(rule.baseUrl, mapped));
        }
      }
    }

    for (const baseDir of resolver.baseDirs) {
      candidates.push(path.resolve(baseDir, specifier));
    }
  }

  for (const candidateBase of candidates) {
    const resolvedAbsolutePath = await resolveCandidateBase(candidateBase, cache);
    if (!resolvedAbsolutePath) continue;
    const info = describePath(resolvedAbsolutePath, repoRoot, scopeRoot);
    if (info.scopeKind === "external") continue;

    const result = {
      ...info,
      category: classifyPath(info),
    };
    cache.set(resolutionKey, result);
    return result;
  }

  cache.set(resolutionKey, null);
  return null;
}

function makeTrace(node, nodeByKey, outgoingMap, incomingMap) {
  const outgoingKeys = [...(outgoingMap.get(node.key) || [])]
    .map((key) => nodeByKey.get(key))
    .filter(Boolean);
  const incomingKeys = [...(incomingMap.get(node.key) || [])]
    .map((key) => nodeByKey.get(key))
    .filter(Boolean);

  return {
    path: node.path,
    category: node.category,
    scopeKind: node.scopeKind,
    dependencyCount: outgoingKeys.length,
    dependentCount: incomingKeys.length,
    directDependencies: outgoingKeys.slice(0, 12).map((item) => ({
      path: item.path,
      category: item.category,
      scopeKind: item.scopeKind,
    })),
    directDependents: incomingKeys.slice(0, 12).map((item) => ({
      path: item.path,
      category: item.category,
      scopeKind: item.scopeKind,
    })),
  };
}

function compareTraceStrength(a, b) {
  if (a.dependentCount !== b.dependentCount) {
    return b.dependentCount - a.dependentCount;
  }
  if (a.dependencyCount !== b.dependencyCount) {
    return b.dependencyCount - a.dependencyCount;
  }
  return a.path.localeCompare(b.path);
}

function summarizeDependencyGraph(nodeByKey, outgoingMap, incomingMap) {
  const nodes = [...nodeByKey.values()];
  const scopeNodes = nodes.filter((node) => node.scopeKind === "scope");
  const traces = scopeNodes.map((node) =>
    makeTrace(node, nodeByKey, outgoingMap, incomingMap)
  );
  const strategicHubCategories = new Set([
    "layout",
    "route",
    "provider",
    "store",
    "feature",
    "lib",
    "context",
    "config",
  ]);

  const traceByPath = new Map(traces.map((trace) => [trace.path, trace]));
  const keyTracePaths = [
    "app/_layout.tsx",
    "src/providers/AppProviders.tsx",
    ...traces
      .filter(
        (trace) =>
          trace.category === "provider" ||
          trace.category === "store" ||
          trace.category === "layout"
      )
      .sort(compareTraceStrength)
      .map((trace) => trace.path),
  ];

  const keyTraces = [];
  const seen = new Set();
  for (const keyPath of keyTracePaths) {
    if (seen.has(keyPath)) continue;
    const trace = traceByPath.get(keyPath);
    if (!trace) continue;
    keyTraces.push(trace);
    seen.add(keyPath);
    if (keyTraces.length >= 8) break;
  }

  const prioritizedHubPool = traces.filter(
    (trace) =>
      strategicHubCategories.has(trace.category) && trace.dependentCount > 0
  );
  const dependencyHubs = [
    ...(prioritizedHubPool.length >= 6
      ? prioritizedHubPool
      : traces.filter((trace) => trace.dependentCount > 0)),
  ]
    .sort(compareTraceStrength)
    .slice(0, 8);

  const routeTraces = traces
    .filter((trace) => trace.category === "route" || trace.category === "layout")
    .sort(compareTraceStrength)
    .slice(0, 6);

  const providerTraces = traces
    .filter((trace) => trace.category === "provider")
    .sort(compareTraceStrength)
    .slice(0, 6);

  return {
    nodeCount: nodes.length,
    scopeNodeCount: scopeNodes.length,
    repoDependencyCount: nodes.filter((node) => node.scopeKind === "repo").length,
    keyTraces,
    dependencyHubs,
    routeTraces,
    providerTraces,
  };
}

async function buildDependencyGraph(allFiles, sourceByPath, repoRoot, scopeRoot) {
  const resolver = await loadImportResolver(repoRoot, scopeRoot);
  const nodeByKey = new Map();
  const outgoingMap = new Map();
  const incomingMap = new Map();
  const resolutionCache = new Map();
  const edges = [];
  const seenEdges = new Set();

  for (const file of allFiles) {
    if (!JS_LIKE_LANGUAGES.has(file.language)) continue;

    const source = sourceByPath.get(file.relativePath) || "";
    const specifiers = extractImportSpecifiers(source);
    if (specifiers.length === 0) continue;

    const fromInfo = {
      ...describePath(file.absolutePath, repoRoot, scopeRoot),
      category: classifyPath(
        describePath(file.absolutePath, repoRoot, scopeRoot)
      ),
    };
    const fromKey = fromInfo.repoRelativePath || fromInfo.absolutePath;
    nodeByKey.set(fromKey, {
      key: fromKey,
      path: displayPath(fromInfo),
      scopeKind: fromInfo.scopeKind,
      category: fromInfo.category,
    });

    for (const specifier of specifiers) {
      const resolved = await resolveImportTarget(
        specifier,
        file.absolutePath,
        resolver,
        repoRoot,
        scopeRoot,
        resolutionCache
      );
      if (!resolved) continue;

      const toKey = resolved.repoRelativePath || resolved.absolutePath;
      nodeByKey.set(toKey, {
        key: toKey,
        path: displayPath(resolved),
        scopeKind: resolved.scopeKind,
        category: resolved.category,
      });

      const edgeKey = `${fromKey}::${toKey}`;
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);

      edges.push({
        from: displayPath(fromInfo),
        to: displayPath(resolved),
        specifier,
        toScopeKind: resolved.scopeKind,
      });

      if (!outgoingMap.has(fromKey)) outgoingMap.set(fromKey, new Set());
      if (!incomingMap.has(toKey)) incomingMap.set(toKey, new Set());
      outgoingMap.get(fromKey).add(toKey);
      incomingMap.get(toKey).add(fromKey);
    }
  }

  return {
    edges,
    summaries: summarizeDependencyGraph(nodeByKey, outgoingMap, incomingMap),
  };
}

async function walkCodeFiles(rootDir, currentDir, entries = []) {
  const children = await fs.readdir(currentDir, { withFileTypes: true });

  for (const child of children) {
    const absolutePath = path.join(currentDir, child.name);
    const relativePath = toPosix(path.relative(rootDir, absolutePath));

    if (child.isDirectory()) {
      if (SKIP_DIRS.has(child.name)) continue;
      await walkCodeFiles(rootDir, absolutePath, entries);
      continue;
    }

    const ext = path.extname(child.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
    if (relativePath.includes("__tests__")) continue;
    if (relativePath.includes(".test.") || relativePath.includes(".spec.")) {
      continue;
    }
    if (relativePath.endsWith(".d.ts")) continue;

    const stat = await fs.stat(absolutePath);
    if (stat.size > DEFAULTS.maxFileSize) continue;

    entries.push({
      absolutePath,
      relativePath,
      size: stat.size,
      score: scoreCodeFile(relativePath),
      language: detectLanguage(relativePath),
    });
  }

  return entries;
}

function extractBraceBlock(source, startIdx) {
  let depth = 0;
  let foundOpen = false;
  let i = startIdx;

  while (i < source.length) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      foundOpen = true;
    } else if (ch === "}") {
      depth -= 1;
      if (foundOpen && depth === 0) {
        return source.slice(startIdx, i + 1);
      }
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") i += 1;
        i += 1;
      }
    }

    i += 1;
  }

  return null;
}

function extractIndentBlock(source, startIdx) {
  const lines = source.slice(startIdx).split("\n");
  if (lines.length < 2) return null;

  const result = [lines[0]];
  const baseIndent = lines[1]?.match(/^(\s*)/)?.[1]?.length ?? 0;
  if (baseIndent === 0) return lines[0];

  for (let i = 1; i < lines.length; i += 1) {
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

function findJsDoc(source, position) {
  const before = source.slice(Math.max(0, position - 500), position).trimEnd();
  const match = before.match(/\/\*\*\s*([\s\S]*?)\s*\*\/\s*$/);
  if (!match) return null;

  return match[1]
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)
    .join(" ");
}

function findPyDocstring(source, defEnd) {
  const after = source.slice(defEnd, defEnd + 500);
  const match = after.match(/^\s*"""([\s\S]*?)"""/);
  return match ? match[1].trim() : null;
}

function estimateDifficulty(code, blockType, blockName) {
  let complexity = 0;
  const lineCount = code.split("\n").length;

  if (lineCount > 20) complexity += 2;
  else if (lineCount > 10) complexity += 1;

  let maxDepth = 0;
  let depth = 0;
  for (const ch of code) {
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    maxDepth = Math.max(maxDepth, depth);
  }
  if (maxDepth > 4) complexity += 2;
  else if (maxDepth > 2) complexity += 1;

  if (code.includes("async") || code.includes("await")) complexity += 1;
  if (code.includes("<") && code.includes(">")) complexity += 1;

  if (blockType === "function" && blockName) {
    const calls = code.match(new RegExp(`\\b${blockName}\\(`, "g"));
    if (calls && calls.length > 1) complexity += 2;
  }

  if (complexity >= 4) return 3;
  if (complexity >= 2) return 2;
  return 1;
}

function generateExplanation(block) {
  if (block.jsDoc) return block.jsDoc;

  const dir = block.filePath.split("/").slice(0, -1).join("/");
  const dirHint = dir ? ` in ${dir}` : "";

  switch (block.type) {
    case "function":
      return `Exported function${dirHint}. Read the code to understand what ${block.name} does and when you'd use it.`;
    case "type":
      return `Type definition${dirHint}. Defines the shape of ${block.name}.`;
    case "concept":
      return `Concept${dirHint}. Study how ${block.name} organizes logic or state.`;
    case "pattern":
      return `Pattern${dirHint}. A reusable approach to a recurring problem.`;
    case "file":
    default:
      return `Key file${dirHint}. Read through to understand the module's responsibilities.`;
  }
}

function generatePrompt(block) {
  const dir = block.filePath.split("/").slice(0, -1).join("/");
  const dirHint = dir ? ` in ${dir}` : "";

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
    default:
      return `Before you reveal the answer: what is the job of ${block.name}${dirHint} in the wider system?`;
  }
}

function titleCase(value) {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function listPreview(values, max = 4) {
  const unique = [...new Set(values.filter(Boolean))];
  if (unique.length === 0) return "none";
  if (unique.length <= max) return unique.join(", ");
  return `${unique.slice(0, max).join(", ")}, +${unique.length - max} more`;
}

function summarizeBarrelExports(source) {
  const names = [];
  const exportRegex =
    /export\s+(?:\{[^}]*\}\s+from\s+["'][^"']+["']|(?:const|function|class|type|interface)\s+(\w+))/g;
  let match;

  while ((match = exportRegex.exec(source)) !== null) {
    if (match[1]) names.push(match[1]);
  }

  const fromRegex = /export\s+\{([^}]*)\}\s+from\s+["'][^"']+["']/g;
  while ((match = fromRegex.exec(source)) !== null) {
    const exported = match[1]
      .split(",")
      .map((part) => part.trim().split(/\s+as\s+/i)[1] || part.trim().split(/\s+as\s+/i)[0])
      .filter(Boolean);
    names.push(...exported);
  }

  return [...new Set(names)];
}

function extractTsBlocks(source, filePath, language) {
  const blocks = [];
  let match;

  const functionRegex =
    /export\s+(async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)/g;
  while ((match = functionRegex.exec(source)) !== null) {
    const code = extractBraceBlock(source, match.index);
    if (!code) continue;
    const lineCount = code.split("\n").length;
    if (lineCount > 45) continue;
    blocks.push({
      name: match[2],
      type: "function",
      code,
      filePath,
      language,
      jsDoc: findJsDoc(source, match.index),
      lineCount,
    });
  }

  const arrowRegex =
    /export\s+const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g;
  while ((match = arrowRegex.exec(source)) !== null) {
    const rest = source.slice(match.index);
    const endMatch = rest.match(/\n\nexport\s|;\n\n|\nconst\s|\nfunction\s|\nclass\s/);
    const end = endMatch
      ? match.index + (endMatch.index ?? rest.length)
      : match.index + Math.min(rest.length, 1000);
    const code = source.slice(match.index, end).trim();
    const lineCount = code.split("\n").length;
    if (lineCount > 45) continue;
    blocks.push({
      name: match[1],
      type: "function",
      code,
      filePath,
      language,
      jsDoc: findJsDoc(source, match.index),
      lineCount,
    });
  }

  const componentRegex =
    /export\s+(?:default\s+)?(?:function|const)\s+([A-Z]\w+)/g;
  while ((match = componentRegex.exec(source)) !== null) {
    if (blocks.some((block) => block.name === match[1])) continue;
    const code = extractBraceBlock(source, match.index);
    if (!code || !code.includes("<")) continue;
    const lineCount = code.split("\n").length;
    if (lineCount > 60) continue;
    blocks.push({
      name: match[1],
      type: "pattern",
      code,
      filePath,
      language,
      jsDoc: findJsDoc(source, match.index),
      lineCount,
    });
  }

  const typeRegex = /export\s+(type|interface)\s+(\w+)/g;
  while ((match = typeRegex.exec(source)) !== null) {
    const kind = match[1];
    const name = match[2];
    let code;

    if (kind === "interface") {
      code = extractBraceBlock(source, match.index);
    } else {
      const rest = source.slice(match.index);
      const semi = rest.indexOf(";");
      code = source.slice(match.index, match.index + (semi > 0 ? semi + 1 : 200));
    }

    if (!code) continue;
    const lineCount = code.split("\n").length;
    if (lineCount > 35) continue;
    blocks.push({
      name,
      type: "type",
      code: code.trim(),
      filePath,
      language,
      jsDoc: findJsDoc(source, match.index),
      lineCount,
    });
  }

  const classRegex = /export\s+(?:default\s+)?class\s+(\w+)/g;
  while ((match = classRegex.exec(source)) !== null) {
    const code = extractBraceBlock(source, match.index);
    if (!code) continue;
    const lineCount = code.split("\n").length;
    if (lineCount > 60) continue;
    blocks.push({
      name: match[1],
      type: "concept",
      code,
      filePath,
      language,
      jsDoc: findJsDoc(source, match.index),
      lineCount,
    });
  }

  return blocks;
}

function extractPythonBlocks(source, filePath) {
  const blocks = [];
  let match;

  const defRegex = /^(async\s+)?def\s+(\w+)\s*\([^)]*\)/gm;
  while ((match = defRegex.exec(source)) !== null) {
    const name = match[2];
    if (name.startsWith("_") && name !== "__init__") continue;
    const code = extractIndentBlock(source, match.index);
    if (!code) continue;
    const lineCount = code.split("\n").length;
    if (lineCount > 45) continue;
    const colonIndex = source.indexOf(":", match.index + match[0].length);
    blocks.push({
      name,
      type: "function",
      code,
      filePath,
      language: "python",
      jsDoc: colonIndex >= 0 ? findPyDocstring(source, colonIndex + 1) : null,
      lineCount,
    });
  }

  const classRegex = /^class\s+(\w+)(?:\([^)]*\))?:/gm;
  while ((match = classRegex.exec(source)) !== null) {
    const code = extractIndentBlock(source, match.index);
    if (!code) continue;
    const lineCount = code.split("\n").length;
    if (lineCount > 55) continue;
    blocks.push({
      name: match[1],
      type: "concept",
      code,
      filePath,
      language: "python",
      jsDoc: null,
      lineCount,
    });
  }

  return blocks;
}

function createFileFallback(source, filePath, language) {
  const excerpt = source
    .split("\n")
    .slice(0, 80)
    .join("\n")
    .trim();

  if (!excerpt) return null;

  return {
    name: path.basename(filePath),
    type: "file",
    code: excerpt,
    filePath,
    language,
    jsDoc: null,
    lineCount: excerpt.split("\n").length,
  };
}

function shouldCreateFileFallback(filePath, source) {
  const lowSignalSegments = [
    "/assets/",
    "/logos/",
    "/icons/",
    "/generated/",
    "/examples/",
    "/docs/",
    "/__mocks__/",
  ];

  if (lowSignalSegments.some((segment) => filePath.includes(segment))) {
    return false;
  }

  const lineCount = source.split("\n").length;
  if (lineCount < 5 || lineCount > 140) return false;

  const fileName = path.basename(filePath);
  const strategicNames = new Set([
    "App.tsx",
    "index.ts",
    "index.tsx",
    "_layout.tsx",
    "store.ts",
  ]);

  if (strategicNames.has(fileName)) return true;

  return [
    "/app/",
    "/providers/",
    "/stores/",
    "/hooks/",
    "/lib/",
    "/navigation/",
  ].some((segment) => filePath.includes(segment));
}

function extractBlocksFromFile(source, filePath, language) {
  if (language === "typescript" || language === "javascript") {
    return extractTsBlocks(source, filePath, language);
  }

  if (language === "python") {
    return extractPythonBlocks(source, filePath);
  }

  return [];
}

function buildArchitectureCards(allFiles, sourceByPath, sessionName, dependencyGraph) {
  const cards = [];

  const routeFiles = allFiles
    .filter((file) => file.relativePath.startsWith("app/"))
    .map((file) => file.relativePath)
    .filter((filePath) => /\.(tsx|jsx|ts|js)$/.test(filePath))
    .sort();

  if (routeFiles.length > 0) {
    const routeExamples = routeFiles
      .slice(0, 10)
      .map((filePath) => filePath.replace(/^app\//, ""))
      .join("\n");
    cards.push({
      id: "arch-routes-overview",
      type: "concept",
      title: "Routes Overview",
      filePath: "app/",
      language: "text",
      prompt:
        "Before you reveal the answer: how is navigation organized in this repo, and which route files shape the main app flow?",
      code: routeExamples,
      explanation: `The app route surface for ${sessionName} is file-based. Representative route files: ${listPreview(
        routeFiles.map((filePath) => filePath.replace(/^app\//, "")),
        6
      )}. Start here when learning screen flow.`,
      difficulty: 1,
    });
  }

  const featureModules = new Map();
  for (const file of allFiles) {
    const match = file.relativePath.match(/^src\/features\/([^/]+)\//);
    if (!match) continue;
    const feature = match[1];
    const current = featureModules.get(feature) || [];
    current.push(file.relativePath);
    featureModules.set(feature, current);
  }

  for (const [feature, files] of [...featureModules.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 8)) {
    cards.push({
      id: `arch-feature-${feature}`,
      type: "concept",
      title: `Feature Surface: ${titleCase(feature)}`,
      filePath: `src/features/${feature}/`,
      language: "text",
      prompt: `Before you reveal the answer: what responsibilities live inside the ${feature} feature, and which files would you inspect first?`,
      code: files.slice(0, 8).join("\n"),
      explanation: `${titleCase(feature)} is organized under src/features/${feature}. Representative files: ${listPreview(
        files.map((filePath) => filePath.replace(`src/features/${feature}/`, "")),
        5
      )}. Treat this as a module boundary, not just a folder.`,
      difficulty: 1,
    });
  }

  const providerFiles = allFiles
    .filter((file) => file.relativePath.startsWith("src/providers/"))
    .map((file) => file.relativePath);
  if (providerFiles.length > 0) {
    cards.push({
      id: "arch-providers-overview",
      type: "concept",
      title: "Provider Stack Overview",
      filePath: "src/providers/",
      language: "text",
      prompt:
        "Before you reveal the answer: which providers wrap the app, and what global responsibilities do they own?",
      code: providerFiles.slice(0, 10).join("\n"),
      explanation: `Global providers live under src/providers. Start with ${listPreview(
        providerFiles.map((filePath) => path.basename(filePath)),
        6
      )} to understand app-wide context, auth, query, and runtime setup.`,
      difficulty: 2,
    });
  }

  const storeFiles = allFiles
    .filter((file) => file.relativePath.startsWith("src/stores/"))
    .map((file) => file.relativePath);
  if (storeFiles.length > 0) {
    cards.push({
      id: "arch-stores-overview",
      type: "concept",
      title: "State Store Overview",
      filePath: "src/stores/",
      language: "text",
      prompt:
        "Before you reveal the answer: which stores exist, and what slices of app state do they appear to own?",
      code: storeFiles.slice(0, 12).join("\n"),
      explanation: `State stores are concentrated under src/stores. Representative files: ${listPreview(
        storeFiles.map((filePath) => path.basename(filePath, path.extname(filePath))),
        6
      )}. Learning these gives you the quickest map of persistent UI and coordination state.`,
      difficulty: 2,
    });
  }

  const strategicBarrels = allFiles
    .filter((file) => file.relativePath.endsWith("/index.ts") || file.relativePath.endsWith("/index.tsx"))
    .filter((file) =>
      [
        "src/features/",
        "src/components/",
        "src/providers/",
        "src/stores/",
      ].some((prefix) => file.relativePath.startsWith(prefix))
    )
    .slice(0, 10);

  for (const barrel of strategicBarrels) {
    const source = sourceByPath.get(barrel.relativePath) || "";
    const exports = summarizeBarrelExports(source);
    if (exports.length === 0) continue;

    cards.push({
      id: `arch-barrel-${barrel.relativePath.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      type: "file",
      title: `Barrel Surface: ${barrel.relativePath.split("/").slice(-2, -1)[0] || "index"}`,
      filePath: barrel.relativePath,
      language: "text",
      prompt: `Before you reveal the answer: what public surface does ${barrel.relativePath} expose to the rest of the codebase?`,
      code: exports.join("\n"),
      explanation: `${barrel.relativePath} re-exports the module surface. Visible exports include ${listPreview(
        exports,
        6
      )}. Barrel files are good shortcuts for understanding what a module wants other code to import.`,
      difficulty: 1,
    });
  }

  const rootLayoutTrace = dependencyGraph?.summaries?.keyTraces?.find(
    (trace) => trace.path === "app/_layout.tsx"
  );
  if (rootLayoutTrace && rootLayoutTrace.directDependencies.length > 0) {
    cards.push({
      id: "arch-dependency-root-layout",
      type: "concept",
      title: "Dependency Trace: Root Layout",
      filePath: rootLayoutTrace.path,
      language: "text",
      prompt:
        "Before you reveal the answer: which real modules does the root layout compose, and what does that tell you about the app shell?",
      code: rootLayoutTrace.directDependencies
        .map((dependency) => dependency.path)
        .join("\n"),
      explanation: `${rootLayoutTrace.path} directly composes ${listPreview(
        rootLayoutTrace.directDependencies.map((dependency) => dependency.path),
        6
      )}. This is the real app-shell dependency trace for ${sessionName}, not just a folder heuristic.`,
      difficulty: 2,
    });
  }

  const appProvidersTrace = dependencyGraph?.summaries?.keyTraces?.find(
    (trace) => trace.path === "src/providers/AppProviders.tsx"
  );
  if (appProvidersTrace && appProvidersTrace.directDependencies.length > 0) {
    cards.push({
      id: "arch-dependency-app-providers",
      type: "concept",
      title: "Dependency Trace: AppProviders",
      filePath: appProvidersTrace.path,
      language: "text",
      prompt:
        "Before you reveal the answer: which systems does AppProviders actually bring online before screens render?",
      code: appProvidersTrace.directDependencies
        .map((dependency) => dependency.path)
        .join("\n"),
      explanation: `${appProvidersTrace.path} directly depends on ${listPreview(
        appProvidersTrace.directDependencies.map((dependency) => dependency.path),
        6
      )}. Use this trace to talk about what global runtime systems the app boots before feature code gets control.`,
      difficulty: 2,
    });
  }

  const dependencyHubs =
    dependencyGraph?.summaries?.dependencyHubs?.filter(
      (trace) =>
        trace.path !== rootLayoutTrace?.path &&
        trace.path !== appProvidersTrace?.path &&
        trace.dependentCount > 0 &&
        trace.dependencyCount > 0 &&
        ["layout", "route", "provider", "store", "lib", "context", "config"].includes(
          trace.category
        )
    ) || [];

  for (const hub of dependencyHubs.slice(0, 2)) {
    cards.push({
      id: `arch-dependency-hub-${hub.path.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      type: "concept",
      title: `Dependency Hub: ${path.basename(hub.path, path.extname(hub.path))}`,
      filePath: hub.path,
      language: "text",
      prompt: `Before you reveal the answer: why is ${hub.path} a load-bearing node in the codebase?`,
      code: hub.directDependents.map((dependency) => dependency.path).join("\n"),
      explanation: `${hub.path} has direct fan-in from ${hub.dependentCount} local files, including ${listPreview(
        hub.directDependents.map((dependency) => dependency.path),
        5
      )}. When Bobby asks what is load-bearing, this is the kind of node you can point to.`,
      difficulty: 2,
    });
  }

  return cards;
}

function rankBlocks(blocks, fileScores) {
  const typeWeight = {
    pattern: 28,
    function: 24,
    concept: 18,
    type: 12,
    file: 2,
  };

  return [...blocks].sort((a, b) => {
    const scoreA =
      (fileScores.get(a.filePath) || 0) +
      (typeWeight[a.type] || 0) +
      (a.jsDoc ? 8 : 0) -
      a.lineCount / 10;
    const scoreB =
      (fileScores.get(b.filePath) || 0) +
      (typeWeight[b.type] || 0) +
      (b.jsDoc ? 8 : 0) -
      b.lineCount / 10;

    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.filePath.localeCompare(b.filePath);
  });
}

function toCard(block, index) {
  const slug = block.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `local-${index}-${slug || "card"}`,
    type: block.type,
    title: block.name,
    filePath: block.filePath,
    code: block.code,
    language: block.language,
    prompt: generatePrompt(block),
    explanation: generateExplanation(block),
    difficulty: estimateDifficulty(block.code, block.type, block.name),
  };
}

async function getRepoDisplayName(repoRoot) {
  const packageJsonPath = path.join(repoRoot, "package.json");
  if (await exists(packageJsonPath)) {
    try {
      const raw = await fs.readFile(packageJsonPath, "utf8");
      const parsed = JSON.parse(raw);
      if (typeof parsed.name === "string" && parsed.name.trim()) {
        return parsed.name.replace(/^@[^/]+\//, "");
      }
    } catch {
      // Ignore malformed package.json and fall back to directory name.
    }
  }

  return path.basename(repoRoot);
}

async function main() {
  const { repoPath, scope, out, maxFiles, maxCards } = parseArgs(
    process.argv.slice(2)
  );
  const resolvedRepoRoot = path.resolve(repoPath);
  const normalizedScope = normalizeScopePath(scope);
  const scopeRoot = normalizedScope
    ? path.join(resolvedRepoRoot, normalizedScope)
    : resolvedRepoRoot;

  if (!(await exists(resolvedRepoRoot))) {
    throw new Error(`Repo path does not exist: ${resolvedRepoRoot}`);
  }

  if (!(await exists(scopeRoot))) {
    throw new Error(`Scope path does not exist: ${scopeRoot}`);
  }

  const repoName = await getRepoDisplayName(resolvedRepoRoot);
  const sessionName = normalizedScope
    ? `${repoName}#${normalizedScope}`
    : repoName;

  console.log(`Scanning ${sessionName}...`);

  const allFiles = await walkCodeFiles(scopeRoot, scopeRoot);
  for (const file of allFiles) {
    file.repoRelativePath = toRepoPath(file.absolutePath, resolvedRepoRoot);
  }
  const selectedFiles = allFiles
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.size !== b.size) return a.size - b.size;
      return a.relativePath.localeCompare(b.relativePath);
    })
    .slice(0, maxFiles);

  if (selectedFiles.length === 0) {
    throw new Error("No supported code files found in the selected path.");
  }

  const fileScores = new Map(
    selectedFiles.map((file) => [file.relativePath, file.score])
  );
  const sourceByPath = new Map();
  const blocks = [];
  let fileFallbackCount = 0;

  for (const file of allFiles) {
    const source = await fs.readFile(file.absolutePath, "utf8");
    sourceByPath.set(file.relativePath, source);
  }

  for (const file of selectedFiles) {
    const source = sourceByPath.get(file.relativePath) || "";
    const extracted = extractBlocksFromFile(
      source,
      file.relativePath,
      file.language
    );

    if (extracted.length > 0) {
      blocks.push(...extracted);
      continue;
    }

    if (!shouldCreateFileFallback(file.relativePath, source)) {
      continue;
    }

    if (fileFallbackCount >= 12) {
      continue;
    }

    const fallback = createFileFallback(
      source,
      file.relativePath,
      file.language
    );
    if (fallback) {
      blocks.push(fallback);
      fileFallbackCount += 1;
    }
  }

  if (blocks.length === 0) {
    throw new Error("Could not extract any learnable blocks from the local repo.");
  }

  const dependencyGraph = await buildDependencyGraph(
    allFiles,
    sourceByPath,
    resolvedRepoRoot,
    scopeRoot
  );
  const architectureCards = buildArchitectureCards(
    allFiles,
    sourceByPath,
    sessionName,
    dependencyGraph
  );
  const ranked = rankBlocks(blocks, fileScores);
  const implementationCards = ranked
    .slice(0, Math.max(0, maxCards - architectureCards.length))
    .map(toCard);
  const cards = [...architectureCards, ...implementationCards].slice(0, maxCards);
  const deck = {
    version: 1,
    meta: {
      repoName: sessionName,
      description: `Local deck exported from ${sessionName}`,
      generatedAt: new Date().toISOString(),
      sourceType: "local",
      sourcePath: resolvedRepoRoot,
      scopePath: normalizedScope || undefined,
      relationships: dependencyGraph,
    },
    cards,
  };

  const safeName = sessionName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const outputPath = out
    ? path.resolve(out)
    : path.join(process.cwd(), `${safeName || "deck"}.json`);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(deck, null, 2)}\n`, "utf8");

  console.log(`Exported ${cards.length} cards to ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
