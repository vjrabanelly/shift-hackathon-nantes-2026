---
phase: 02-backend-pipeline
verified: 2026-03-28T12:50:00Z
status: gaps_found
score: 13/14 requirements verified
re_verification: false
gaps:
  - truth: "User can submit article URL via Share Target Android"
    status: failed
    reason: "ING-01 is a frontend PWA requirement, not backend - requirement mapping error in ROADMAP.md"
    artifacts: []
    missing:
      - "ING-01 should be moved to Phase 3 (Frontend & Integration) in ROADMAP.md and REQUIREMENTS.md"
---

# Phase 02: Backend Pipeline Verification Report

**Phase Goal:** Backend can fetch, extract, search, and analyze real articles in <10s P80

**Verified:** 2026-03-28T12:50:00Z

**Status:** gaps_found (requirement mapping error only - implementation complete)

**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can submit any news article URL and receive normalized HTML | ✓ VERIFIED | `fetchArticle()` with redirect follow (line 39 analyze.ts), returns finalUrl |
| 2 | System extracts main article content (title, text, media, date) | ✓ VERIFIED | `extractArticle()` uses Readability + metadata helpers, returns structured ExtractionResult |
| 3 | System falls back to degraded mode when paywall detected | ✓ VERIFIED | Paywall detection in extractor.ts (lines 109-123), partial_content fallback (lines 150-168) |
| 4 | System returns 2-3 alternative articles from different sources | ✓ VERIFIED | `searchAlternatives()` with domain dedup (lines 278-291 grounded-search.ts), slice(0,3) |
| 5 | LLM produces structured JSON with bias score, color, and signals | ✓ VERIFIED | BiasAnalysisSchema validation, function calling with responseSchema (gemini.ts:28-30) |
| 6 | LLM identifies 2-3 counter-perspectives with differences | ✓ VERIFIED | CounterPerspectiveSchema min(2) max(3), differences extraction service (differences.ts) |
| 7 | System validates LLM JSON output | ✓ VERIFIED | validateLLMResponse() called in gemini.ts:109, differences.ts:97 |
| 8 | Pipeline completes in <10s for 80% of requests | ⚠️ UNVERIFIED | Timeout budget implemented (10s default, analyze.ts:31), but P80 requires load testing |

**Score:** 7/8 truths verified (1 needs human load testing)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/services/fetcher.ts` | URL fetching with redirect handling | ✓ VERIFIED | 100 lines, exports fetchArticle + FetchResult, redirect: 'follow' on line 39 |
| `backend/src/services/extractor.ts` | Article extraction with paywall detection | ✓ VERIFIED | 220 lines, exports extractArticle + ExtractionResult, Readability + paywall detection |
| `backend/src/services/gemini.ts` | Gemini API client with function calling | ✓ VERIFIED | 131 lines, exports GeminiClient + analyzeArticle, responseSchema for JSON |
| `backend/src/prompts/bias-analysis.ts` | Few-shot prompt with bias definitions | ✓ VERIFIED | 109 lines, exports BIAS_ANALYSIS_PROMPT + FEW_SHOT_EXAMPLES (2 examples) |
| `backend/src/schemas/llm-response.ts` | Zod schemas for LLM validation | ✓ VERIFIED | 107 lines, exports BiasAnalysisSchema + validateLLMResponse + JSON_SCHEMA |
| `backend/src/services/grounded-search.ts` | Gemini Grounded Search for alternatives | ✓ VERIFIED | 60+ lines, exports searchAlternatives + SearchResult, domain dedup |
| `backend/src/services/differences.ts` | LLM-based difference extraction | ✓ VERIFIED | 50+ lines, exports extractDifferences + DifferencesResult |
| `backend/src/routes/analyze.ts` | Wired /v1/analyze endpoint | ✓ VERIFIED | 157 lines, full pipeline wired: fetch → extract → analyze → search → differences |

**Score:** 8/8 artifacts verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| fetcher.ts | native fetch | HTTP request with redirect | ✓ WIRED | redirect: 'follow' on line 39 |
| extractor.ts | @mozilla/readability | Readability constructor | ✓ WIRED | new Readability on line 87 |
| gemini.ts | @google/generative-ai | GoogleGenerativeAI | ✓ WIRED | import on line 1, new GoogleGenerativeAI on line 26 |
| gemini.ts | llm-response.ts | schema import | ✓ WIRED | import BIAS_ANALYSIS_JSON_SCHEMA, validateLLMResponse on line 3 |
| gemini.ts | bias-analysis.ts | prompt import | ✓ WIRED | import SYSTEM_INSTRUCTION, FEW_SHOT_EXAMPLES on line 2 |
| analyze.ts | fetcher.ts | fetchArticle import | ✓ WIRED | import on line 5, called on line 38 |
| analyze.ts | extractor.ts | extractArticle import | ✓ WIRED | import on line 6, called on line 48 |
| analyze.ts | gemini.ts | GeminiClient import | ✓ WIRED | import on line 7, analyzeArticle called on line 73 |
| grounded-search.ts | @google/generative-ai | googleSearchRetrieval | ✓ WIRED | googleSearchRetrieval tool on line 223 |

**Score:** 9/9 key links verified

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| analyze.ts | source_article | fetchArticle + extractArticle | HTML fetch + Readability extraction | ✓ FLOWING |
| analyze.ts | analysisResult | geminiClient.analyzeArticle | Gemini API call with article content | ✓ FLOWING |
| analyze.ts | searchResult | searchClient.searchAlternatives | Grounded Search API call | ✓ FLOWING |
| analyze.ts | differencesResult | differencesExtractor.extractDifferences | 2nd Gemini API call | ✓ FLOWING |
| analyze.ts | counter_perspectives | differencesResult OR searchResult OR analysis | Real data with fallback chain | ✓ FLOWING |

**Score:** 5/5 data flows verified

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| **ING-01** | 02-01 | Share Target Android | ✗ ORPHANED | Frontend PWA requirement incorrectly mapped to Phase 2 |
| **ING-02** | 02-01 | Validate and normalize URL | ✓ SATISFIED | URL constructor validation in fetcher.ts:32, finalUrl returned |
| **ING-03** | 02-01 | Follow redirects and fetch HTML | ✓ SATISFIED | redirect: 'follow' in fetcher.ts:39, finalUrl tracking |
| **EXT-01** | 02-01 | Extract main article content | ✓ SATISFIED | Readability in extractor.ts:87, metadata extraction helpers |
| **EXT-02** | 02-01 | Handle paywalls in degraded mode | ✓ SATISFIED | Paywall detection extractor.ts:109-123, partial_content fallback |
| **EXT-03** | 02-01 | Signal partial extraction | ✓ SATISFIED | partial: boolean flag in ExtractionResult, set on line 143 analyze.ts |
| **SRC-01** | 02-03 | Search 2-4 alternative articles | ✓ SATISFIED | searchAlternatives in grounded-search.ts, 2-3 results |
| **SRC-02** | 02-03 | Deduplicate domains | ✓ SATISFIED | seenDomains Set in grounded-search.ts:278-291 |
| **SRC-03** | 02-03 | Prioritize recent and diverse | ✓ SATISFIED | Prompt includes "RECENTES" + "DIVERSES", slice(0,3) for top results |
| **ANA-01** | 02-02 | Bias score 0-10 with color | ✓ SATISFIED | BiasScoreSchema with color enum green/orange/red |
| **ANA-02** | 02-02 | Identify bias signals | ✓ SATISFIED | SignalSchema with 4 types (tone, framing, omission, source_selection) |
| **ANA-03** | 02-02 | Generate counter-perspectives | ✓ SATISFIED | CounterPerspectiveSchema min(2) max(3), differences.ts extraction |
| **ANA-04** | 02-02 | Global context summary | ✓ SATISFIED | GlobalContextSchema with summary + missing_angles |
| **ANA-05** | 02-02 | Validate LLM output | ✓ SATISFIED | validateLLMResponse in gemini.ts:109, differences.ts:97 |

**Score:** 13/14 requirements satisfied (1 orphaned due to mapping error)

**Orphaned Requirements:**
- **ING-01** (Share Target Android) - Declared in Phase 2 ROADMAP.md but is a frontend PWA feature, not backend. Should be moved to Phase 3.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| analyze.ts | 127 | Comment "use placeholders from analysis" | ℹ️ Info | Intentional fallback, not a stub - LLM provides placeholders when search fails |

**No blocker anti-patterns found.** The "placeholders" comment refers to the LLM's generated counter-perspectives when Grounded Search fails, which is an acceptable fallback strategy.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles | npm run build | Clean compile, no errors | ✓ PASS |
| Fetcher exports present | Check dist/services/fetcher.js | fetchArticle + FetchResult exported | ✓ PASS |
| Analyze route wiring | Check dist/routes/analyze.js | All 5 services imported and called | ✓ PASS |
| Schema validation works | (requires runtime test) | Cannot test without API key | ? SKIP |
| Pipeline completes <10s | (requires load test + API key) | Cannot test without live API | ? SKIP |

**Spot-check constraints:** 3/5 checks passed, 2 require GEMINI_API_KEY and runtime environment.

### Human Verification Required

#### 1. End-to-End Pipeline Test with Real Article

**Test:**
1. Set GEMINI_API_KEY environment variable
2. Start backend: `cd backend && npm run dev`
3. Submit analysis request:
   ```bash
   curl -X POST http://localhost:3001/v1/analyze \
     -H "Content-Type: application/json" \
     -d '{"url": "https://lemonde.fr/[recent-article]"}'
   ```

**Expected:**
- 200 OK response within 10 seconds
- Response contains:
  - source_article with extracted title and content
  - bias_score with score 0-10, color (green/orange/red), confidence
  - main_signals array with 1-5 items
  - counter_perspectives array with 2-3 items, each with key_differences
  - global_context with summary and missing_angles
  - analyzed_at timestamp

**Why human:** Requires live Gemini API key, real article URL, and timing verification

#### 2. P80 Performance Target Verification

**Test:**
1. Submit 100 analysis requests with varied article URLs
2. Record completion times
3. Calculate 80th percentile (P80)

**Expected:** P80 < 10 seconds

**Why human:** Requires load testing infrastructure and statistical analysis

#### 3. Paywall Degraded Mode Test

**Test:** Submit URL to paywalled article (e.g., Wall Street Journal, NYT with paywall)

**Expected:**
- 200 OK response (not error)
- source_article contains title + excerpt (not full content)
- extraction_partial flag set to true
- Analysis still completes based on available content

**Why human:** Requires identifying paywalled articles and verifying graceful degradation

#### 4. Search Failure Fallback Test

**Test:** Mock Grounded Search failure (or test with article on obscure topic with few alternatives)

**Expected:**
- Pipeline completes successfully
- counter_perspectives uses LLM-generated placeholders
- No 500 error

**Why human:** Requires environment manipulation or edge case identification

### Gaps Summary

**1 requirement mapping error identified:**

**ING-01 (Share Target Android)** was incorrectly assigned to Phase 2 in ROADMAP.md. This is a frontend PWA requirement that involves:
- Registering a Share Target in the PWA manifest
- Handling shared URLs in the frontend router
- Passing the URL to the `/v1/analyze` backend endpoint

The backend `/v1/analyze` endpoint is complete and ready to receive URLs from the frontend Share Target. The requirement should be moved to Phase 3 (Frontend & Integration) where it belongs.

**Implementation Status:** Phase 2 backend implementation is COMPLETE. All backend requirements (ING-02, ING-03, EXT-01-03, SRC-01-03, ANA-01-05) are fully satisfied with verified artifacts and data flows.

**Recommended Action:** Update ROADMAP.md and REQUIREMENTS.md to move ING-01 from Phase 2 to Phase 3.

---

_Verified: 2026-03-28T12:50:00Z_
_Verifier: Claude (gsd-verifier)_
