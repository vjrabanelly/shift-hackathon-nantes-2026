---
phase: 02-backend-pipeline
plan: 02
subsystem: backend
tags: [llm, gemini, bias-analysis, validation]
dependency_graph:
  requires:
    - shared/dist/types/analysis.d.ts
  provides:
    - backend/src/schemas/llm-response.ts
    - backend/src/prompts/bias-analysis.ts
    - backend/src/services/gemini.ts
  affects:
    - future: backend API routes will use GeminiClient for analysis
tech_stack:
  added:
    - Gemini 1.5 Flash (LLM)
    - Zod (schema validation)
    - @google/generative-ai (SDK)
  patterns:
    - Function calling for structured JSON output
    - Few-shot prompting for consistent analysis
    - Discriminated unions for type-safe error handling
key_files:
  created:
    - backend/src/schemas/llm-response.ts (107 lines)
    - backend/src/prompts/bias-analysis.ts (109 lines)
    - backend/src/services/gemini.ts (131 lines)
    - backend/.env.example (1 line)
  modified:
    - backend/src/services/fetcher.ts (fixed interface -> type)
    - backend/src/services/extractor.ts (fixed interface -> type)
    - backend/src/mocks/analysis-mock.ts (fixed import path)
    - backend/src/routes/health.ts (fixed import path)
decisions:
  - choice: "Gemini 1.5 Flash with temperature 0.2"
    rationale: "Low temperature ensures consistent analysis without stifling nuance"
    alternatives: ["Higher temp (0.5+) - too variable", "GPT-4 - slower and more expensive"]
  - choice: "Function calling with JSON schema"
    rationale: "Guarantees structured output, eliminates parsing errors"
    alternatives: ["Prompt engineering only - unreliable", "Regex extraction - brittle"]
  - choice: "Few-shot with 2 examples (neutral + biased)"
    rationale: "Representative coverage without excessive token cost"
    alternatives: ["Zero-shot - less reliable", "5+ shots - diminishing returns"]
  - choice: "French language output"
    rationale: "Product requirement - BlindSpot targets French news media"
    alternatives: ["English - wrong market"]
metrics:
  duration_minutes: 5
  completed_date: "2026-03-28"
  task_count: 3
  file_count: 8
  lines_added: 355
  commits: 3
requirements_completed:
  - ANA-01
  - ANA-02
  - ANA-03
  - ANA-04
  - ANA-05
---

# Phase 02 Plan 02: LLM Analysis Core Summary

**One-liner:** Gemini Flash integration with function calling, few-shot French prompts, and Zod validation for structured bias analysis.

## What Was Built

### 1. Zod Schemas for LLM Response Validation (Task 1)
- **BiasScoreSchema**: 0-10 scale with green/orange/red color mapping
- **SignalSchema**: Four bias types (tone, framing, omission, source_selection) with severity
- **CounterPerspectiveSchema**: Alternative perspectives with key differences highlighted
- **GlobalContextSchema**: Summary + missing angles
- **BiasAnalysisSchema**: Complete response schema combining all components
- **validateLLMResponse()**: Validation function returning detailed error messages
- **BIAS_ANALYSIS_JSON_SCHEMA**: JSON Schema version for Gemini function calling

All schemas match shared types from `shared/dist/types/analysis.d.ts` exactly.

### 2. Few-Shot Bias Analysis Prompt (Task 2)
- **BIAS_DEFINITIONS**: French definitions for 4 bias types with concrete examples
- **SCORING_CRITERIA**: 0-3 (green), 4-6 (orange), 7-10 (red) scoring guide
- **FEW_SHOT_EXAMPLES**: 2 examples (neutral article + biased article) with full JSON responses
- **BIAS_ANALYSIS_PROMPT**: Main instruction prompt combining definitions + criteria
- **SYSTEM_INSTRUCTION**: Final prompt enforcing JSON-only output

All content in French per product requirement.

### 3. Gemini Service with Function Calling (Task 3)
- **GeminiClient class**: Configurable LLM client with analyzeArticle method
- **Function calling**: Uses `responseSchema` + `responseMimeType: 'application/json'` for guaranteed structured output
- **Few-shot chat**: Injects examples via chat history before sending article
- **Temperature 0.2**: Low temp for consistency while preserving analytical nuance
- **Timeout handling**: 8000ms default (8s), returns discriminated union on timeout
- **Zod validation**: Double-checks LLM output against schema (per ANA-05)
- **Token usage tracking**: Returns input/output token counts when available
- **Error handling**: Four error types (API_ERROR, VALIDATION_ERROR, TIMEOUT, INVALID_RESPONSE)
- **Factory function**: createGeminiClient() with env var fallback and validation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed discriminated union syntax in fetcher.ts and extractor.ts**
- **Found during:** Task 1 build
- **Issue:** TypeScript compiler error - `interface X { ... } | { ... }` syntax is invalid
- **Fix:** Changed `export interface FetchResult` → `export type FetchResult` and same for ExtractionResult
- **Files modified:** backend/src/services/fetcher.ts, backend/src/services/extractor.ts
- **Commit:** 5f9c78a

**2. [Rule 3 - Blocking] Fixed import paths for shared types**
- **Found during:** Task 1 build
- **Issue:** Imports used `@blindspot/shared/types/analysis` but no monorepo config exists
- **Fix:** Changed imports to relative path `../../../shared/dist/types/analysis.js`
- **Files modified:** backend/src/mocks/analysis-mock.ts, backend/src/routes/health.ts
- **Commit:** 5f9c78a

**3. [Rule 3 - Blocking] Installed missing dependencies**
- **Found during:** Task 1 build
- **Issue:** @mozilla/readability, jsdom, and other deps not installed
- **Fix:** Ran `npm install` to install from package.json
- **Commit:** (no commit - build artifact)

## Verification Results

All verification steps passed:

1. **TypeScript compilation**: `npm run build` — Clean compile, no errors
2. **Schema validation test**: Valid data passes, invalid data returns detailed errors
3. **Prompt structure test**: All exports present (BIAS_DEFINITIONS, SCORING_CRITERIA, FEW_SHOT_EXAMPLES, SYSTEM_INSTRUCTION)
4. **GeminiClient test**: Exports correct, throws helpful error when API key missing

## Technical Decisions

### Gemini 1.5 Flash vs Other LLMs
**Chosen:** Gemini 1.5 Flash
**Why:** Fast response times (<2s typical), native function calling, low cost, 1M context window for future features
**Alternatives considered:** GPT-4 (slower, more expensive), Claude (no function calling in streaming)

### Temperature 0.2 vs Higher
**Chosen:** 0.2
**Why:** Analysis needs consistency more than creativity, but not so low (0.0) that it loses nuance in detecting subtle bias
**Alternatives considered:** 0.0 (too rigid), 0.5+ (too variable)

### Function Calling vs Prompt Engineering
**Chosen:** Function calling with JSON schema
**Why:** Guaranteed structured output, eliminates JSON parsing errors, built-in schema validation
**Alternatives considered:** Prompt engineering alone (unreliable), regex extraction (brittle)

### Few-Shot Count (2 examples)
**Chosen:** 2 examples (neutral + biased)
**Why:** Covers the range without excessive token cost, representative of extremes
**Alternatives considered:** 0 (zero-shot - less reliable), 3+ (diminishing returns, token cost)

### French Output Language
**Chosen:** French for all prompts and expected LLM output
**Why:** Product targets French news media, users expect French explanations
**No alternatives** - requirement from PROJECT.md

## Known Stubs

**None** - All implementations are complete and functional. The Gemini client is ready to use once API keys are configured.

## Next Steps

From 02-03-PLAN.md:
1. Implement Serper search service for finding counter-perspectives
2. Wire gemini.ts + fetcher.ts + extractor.ts + search into /v1/analyze endpoint
3. Add error handling for degraded mode (partial results when search fails)

## Requirements Completed

- **ANA-01**: Bias score 0-10 with color mapping → BiasScoreSchema validates green/orange/red
- **ANA-02**: Detect 4 bias types (tone, framing, omission, source_selection) → SignalSchema + prompt definitions
- **ANA-03**: Generate 2-3 counter-perspectives → CounterPerspectiveSchema enforces 2-3 items
- **ANA-04**: Global context summary with missing angles → GlobalContextSchema
- **ANA-05**: Validate LLM output against schema → validateLLMResponse() + double validation in GeminiClient

## Self-Check: PASSED

### Created Files Exist
```
FOUND: /home/dacou/repos/shift26-context/backend/src/schemas/llm-response.ts
FOUND: /home/dacou/repos/shift26-context/backend/src/prompts/bias-analysis.ts
FOUND: /home/dacou/repos/shift26-context/backend/src/services/gemini.ts
FOUND: /home/dacou/repos/shift26-context/backend/.env.example
```

### Commits Exist
```
FOUND: 5f9c78a (Task 1: Zod schemas)
FOUND: 1570a06 (Task 2: Few-shot prompt)
FOUND: b5152c9 (Task 3: Gemini service)
```

### Build Verification
```
✓ TypeScript compiles without errors
✓ Schema validation works (valid data returns true, invalid returns errors)
✓ Prompt exports all required constants
✓ GeminiClient exports correctly and validates API key requirement
```

All verification passed.
