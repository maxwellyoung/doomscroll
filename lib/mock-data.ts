import type { CodeCard } from "@/types";

/**
 * Seed data — a fictional but realistic TypeScript codebase.
 * Each card is a self-contained unit of understanding (Alexander: a center).
 * The explanation is the "why", never the "what" — the code shows the what.
 */
export const mockCards: CodeCard[] = [
  {
    id: "1",
    type: "function",
    title: "useDebounce",
    filePath: "src/hooks/useDebounce.ts",
    language: "typescript",
    code: `function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(
      () => setDebounced(value),
      delay
    )
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}`,
    explanation:
      "Waits for the caller to stop changing a value before propagating it. Prevents cascading re-renders and network calls during rapid input.",
    difficulty: 1,
  },
  {
    id: "2",
    type: "type",
    title: "Result<T, E>",
    filePath: "src/lib/result.ts",
    language: "typescript",
    code: `type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}`,
    explanation:
      "Makes failure a first-class citizen. Callers must handle both paths — no surprise throws, no forgotten catches.",
    difficulty: 2,
  },
  {
    id: "3",
    type: "pattern",
    title: "Retry with backoff",
    filePath: "src/lib/fetch.ts",
    language: "typescript",
    code: `async function fetchRetry(
  url: string,
  init?: RequestInit,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, init)
      if (res.ok) return res
    } catch {}
    await sleep(2 ** i * 1000)
  }
  throw new Error("exhausted retries")
}`,
    explanation:
      "Absorbs transient failures with exponential patience. The server gets breathing room instead of a stampede.",
    difficulty: 2,
  },
  {
    id: "4",
    type: "concept",
    title: "Discriminated unions",
    filePath: "src/types/events.ts",
    language: "typescript",
    code: `type Event =
  | { type: "login"; userId: string }
  | { type: "view"; path: string }
  | { type: "error"; message: string }

function handle(e: Event) {
  switch (e.type) {
    case "login": return track(e.userId)
    case "view":  return log(e.path)
    case "error": return report(e.message)
  }
}`,
    explanation:
      "A single 'type' field lets TypeScript narrow the entire shape. Each branch knows exactly what it has — zero casting, zero guessing.",
    difficulty: 1,
  },
  {
    id: "5",
    type: "function",
    title: "createStore",
    filePath: "src/store/create.ts",
    language: "typescript",
    code: `function createStore<T>(initial: T) {
  let state = initial
  const subs = new Set<() => void>()

  return {
    get: () => state,
    set(next: T | ((s: T) => T)) {
      state = typeof next === "function"
        ? (next as (s: T) => T)(state)
        : next
      subs.forEach((fn) => fn())
    },
    subscribe(fn: () => void) {
      subs.add(fn)
      return () => { subs.delete(fn) }
    },
  }
}`,
    explanation:
      "The smallest possible reactive store. No context, no providers, no proxy magic — just a value, subscribers, and a contract.",
    difficulty: 3,
  },
  {
    id: "6",
    type: "file",
    title: "middleware.ts",
    filePath: "src/middleware.ts",
    language: "typescript",
    code: `export function middleware(req: NextRequest) {
  const token = req.cookies.get("session")?.value

  if (!token && req.nextUrl.pathname.startsWith("/app")) {
    return NextResponse.redirect(
      new URL("/login", req.url)
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/app/:path*"],
}`,
    explanation:
      "Runs at the edge before any page renders. A single chokepoint for auth — if there's no session, you never reach the app.",
    difficulty: 2,
  },
  {
    id: "7",
    type: "pattern",
    title: "Optimistic update",
    filePath: "src/hooks/useTodo.ts",
    language: "typescript",
    code: `async function toggle(id: string) {
  // Lie to the UI — it's faster than truth
  setTodos(prev =>
    prev.map(t =>
      t.id === id ? { ...t, done: !t.done } : t
    )
  )
  try {
    await api.patch(\`/todos/\${id}/toggle\`)
  } catch {
    // Truth catches up — revert the lie
    setTodos(prev =>
      prev.map(t =>
        t.id === id ? { ...t, done: !t.done } : t
      )
    )
  }
}`,
    explanation:
      "Update the UI before the server confirms. If reality disagrees, roll back. The perceived speed is the real speed.",
    difficulty: 2,
  },
  {
    id: "8",
    type: "concept",
    title: "Stale closure",
    filePath: "src/hooks/useInterval.ts",
    language: "typescript",
    code: `// The bug: frozen in time
useEffect(() => {
  const id = setInterval(() => {
    console.log(count) // always 0
  }, 1000)
  return () => clearInterval(id)
}, [])

// The fix: a ref escapes the closure
const ref = useRef(count)
ref.current = count
useEffect(() => {
  const id = setInterval(() => {
    console.log(ref.current) // always fresh
  }, 1000)
  return () => clearInterval(id)
}, [])`,
    explanation:
      "Empty deps freeze the closure at render #1. The callback remembers a ghost. A ref is a portal to the present.",
    difficulty: 3,
  },
  {
    id: "9",
    type: "function",
    title: "invariant",
    filePath: "src/lib/invariant.ts",
    language: "typescript",
    code: `function invariant(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(
      \`Invariant violation: \${message}\`
    )
  }
}

// Usage
invariant(user, "user must exist here")
user.name // TypeScript knows it's defined`,
    explanation:
      "A runtime assertion that also narrows the type. Crashes loudly at the impossible instead of silently propagating undefined.",
    difficulty: 1,
  },
  {
    id: "10",
    type: "pattern",
    title: "Compound component",
    filePath: "src/components/Menu.tsx",
    language: "typescript",
    code: `const Ctx = createContext<{
  open: boolean
  toggle: () => void
} | null>(null)

function Menu({ children }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <Ctx value={{ open, toggle: () => setOpen(!open) }}>
      {children}
    </Ctx>
  )
}

Menu.Trigger = ({ children }: Props) => {
  const { toggle } = use(Ctx)!
  return <Pressable onPress={toggle}>{children}</Pressable>
}

Menu.Content = ({ children }: Props) => {
  const { open } = use(Ctx)!
  if (!open) return null
  return <View>{children}</View>
}`,
    explanation:
      "State lives in a shared context. Each sub-component reads what it needs. The API surface is declarative — the wiring is invisible.",
    difficulty: 3,
  },
];
