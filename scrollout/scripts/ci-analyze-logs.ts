/**
 * CI Log Analyzer — parse build/lint/test logs and produce a structured diagnostic.
 *
 * Usage:
 *   npx tsx scripts/ci-analyze-logs.ts <logfile> [--json]
 *
 * Reads a CI job log (piped or file) and extracts:
 *  - TypeScript compiler errors (tsc)
 *  - ESLint violations
 *  - Vitest failures
 *  - Gradle/Android build errors
 *  - Generic stack traces
 *
 * Outputs a human-readable summary (or JSON with --json).
 */

import { readFileSync } from "fs";

interface Diagnostic {
  category: "typescript" | "eslint" | "vitest" | "gradle" | "generic";
  file?: string;
  line?: number;
  message: string;
  severity: "error" | "warning";
}

interface AnalysisResult {
  totalErrors: number;
  totalWarnings: number;
  diagnostics: Diagnostic[];
  summary: string;
}

// ── Matchers ──────────────────────────────────────────────

const matchers: Array<{
  category: Diagnostic["category"];
  pattern: RegExp;
  extract: (m: RegExpMatchArray) => Omit<Diagnostic, "category">;
}> = [
  {
    // src/foo.ts(12,5): error TS2345: ...
    category: "typescript",
    pattern: /^(.+?)\((\d+),\d+\):\s+(error|warning)\s+(TS\d+:\s+.+)$/,
    extract: (m) => ({
      file: m[1],
      line: parseInt(m[2]!, 10),
      severity: m[3] === "error" ? "error" : "warning",
      message: m[4]!,
    }),
  },
  {
    // src/foo.ts:12:5  error  @typescript-eslint/no-unused-vars  ...
    category: "eslint",
    pattern: /^\s*(.+?):(\d+):\d+\s+(error|warning)\s+(.+)$/,
    extract: (m) => ({
      file: m[1],
      line: parseInt(m[2]!, 10),
      severity: m[3] === "error" ? "error" : "warning",
      message: m[4]!.trim(),
    }),
  },
  {
    // FAIL  src/__tests__/foo.test.ts > suite > test name
    category: "vitest",
    pattern: /^\s*(?:FAIL|×)\s+(.+?)(?:\s+>\s+(.+))?$/,
    extract: (m) => ({
      file: m[1],
      severity: "error" as const,
      message: m[2] ? `Test failed: ${m[2]}` : `Test suite failed: ${m[1]}`,
    }),
  },
  {
    // > Task :app:compileDebugJavaWithJavac FAILED
    category: "gradle",
    pattern: /^>\s+Task\s+(.+?)\s+FAILED/,
    extract: (m) => ({
      severity: "error" as const,
      message: `Gradle task failed: ${m[1]}`,
    }),
  },
  {
    // e: file:///path/Foo.java:42: error: ...
    category: "gradle",
    pattern: /^e:\s+(?:file:\/\/\/)?(.+?):(\d+):\s+error:\s+(.+)$/,
    extract: (m) => ({
      file: m[1],
      line: parseInt(m[2]!, 10),
      severity: "error" as const,
      message: m[3]!,
    }),
  },
  {
    // Error: something went wrong
    category: "generic",
    pattern: /^(?:Error|FATAL|Caused by):\s+(.+)$/i,
    extract: (m) => ({
      severity: "error" as const,
      message: m[1]!,
    }),
  },
];

// ── Analysis ──────────────────────────────────────────────

function analyzeLog(raw: string): AnalysisResult {
  const lines = raw.split("\n");
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    for (const { category, pattern, extract } of matchers) {
      const m = line.match(pattern);
      if (m) {
        const d = { category, ...extract(m) };
        const key = `${d.category}:${d.file ?? ""}:${d.line ?? ""}:${d.message}`;
        if (!seen.has(key)) {
          seen.add(key);
          diagnostics.push(d);
        }
        break; // first matcher wins
      }
    }
  }

  const totalErrors = diagnostics.filter((d) => d.severity === "error").length;
  const totalWarnings = diagnostics.filter((d) => d.severity === "warning").length;

  const byCategory = diagnostics.reduce(
    (acc, d) => {
      acc[d.category] = (acc[d.category] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const parts = Object.entries(byCategory).map(([cat, n]) => `${n} ${cat}`);
  const summary =
    diagnostics.length === 0
      ? "No issues detected in logs."
      : `Found ${totalErrors} errors, ${totalWarnings} warnings (${parts.join(", ")})`;

  return { totalErrors, totalWarnings, diagnostics, summary };
}

// ── CLI ───────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const file = args.find((a) => !a.startsWith("--"));

  let raw: string;
  if (file) {
    raw = readFileSync(file, "utf-8");
  } else {
    // read from stdin (cross-platform)
    raw = readFileSync(process.stdin.fd, "utf-8");
  }

  const result = analyzeLog(raw);

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n── CI Log Analysis ──────────────────────`);
    console.log(result.summary);
    if (result.diagnostics.length > 0) {
      console.log("");
      for (const d of result.diagnostics) {
        const loc = d.file ? `${d.file}${d.line ? `:${d.line}` : ""}` : "";
        const icon = d.severity === "error" ? "x" : "!";
        console.log(`  [${icon}] [${d.category}] ${loc ? loc + " — " : ""}${d.message}`);
      }
    }
    console.log("");
    process.exit(result.totalErrors > 0 ? 1 : 0);
  }
}

main();
