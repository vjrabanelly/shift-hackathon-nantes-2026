# Roadmap: BlindSpot

**Created:** 2026-03-28
**Granularity:** Coarse (4 phases for 48h hackathon)
**Core Value:** Transformer un lien partage en contexte lisible, nuance et actionnable en moins de 10 secondes.

## Phases

- [ ] **Phase 1: Foundation & API Scaffold** - Project setup, mock endpoints, schema definition
- [ ] **Phase 2: Backend Pipeline** - URL ingestion, content extraction, search, LLM analysis
- [ ] **Phase 3: Frontend & Integration** - React PWA with Share Target, results UI, integration
- [ ] **Phase 4: Robustness & Polish** - Performance optimization, error handling, edge cases

## Phase Details

### Phase 1: Foundation & API Scaffold

**Goal:** Development environment and API structure ready to receive requests and return mock analysis

**Depends on:** Nothing (first phase)

**Requirements:** None (infrastructure phase)

**Success Criteria** (what must be TRUE):
1. Backend responds to GET /health with uptime and version
2. Backend accepts POST /v1/analyze with URL and returns valid mock JSON response
3. JSON schema matches expected structure (source_article, counter_perspectives, global_context)
4. Response includes all required fields (score, color, main_signals, alternatives)

**Plans:** TBD

---

### Phase 2: Backend Pipeline

**Goal:** Backend can fetch, extract, search, and analyze real articles in <10s P80

**Depends on:** Phase 1

**Requirements:** ING-02, ING-03, EXT-01, EXT-02, EXT-03, SRC-01, SRC-02, SRC-03, ANA-01, ANA-02, ANA-03, ANA-04, ANA-05

**Success Criteria** (what must be TRUE):
1. User can submit any news article URL and receive normalized, redirected HTML content
2. System extracts main article content (title, text, media, date) from typical news sites
3. System falls back to degraded mode (title + snippets) when paywall detected
4. System returns 2-3 alternative articles on same topic from different sources
5. LLM produces structured JSON with bias score (0-10), color (green/orange/red), and signals
6. LLM identifies 2-3 counter-perspectives with missing facts highlighted
7. System validates LLM JSON output and rejects malformed responses
8. Pipeline completes in <10s for 80% of requests

**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md - URL ingestion and content extraction (Readability + paywall handling)
- [x] 02-02-PLAN.md - LLM analysis core (Gemini + few-shot + Zod validation)
- [x] 02-03-PLAN.md - Search integration and pipeline wiring (Grounded Search + differences)

---

### Phase 3: Frontend & Integration

**Goal:** Users can share articles from Android and see analysis results in PWA

**Depends on:** Phase 2

**Requirements:** ING-01, UI-01, UI-02, UI-03, UI-04, UI-05

**Success Criteria** (what must be TRUE):
1. User can share article link from Android browser/app to BlindSpot via Share Target
2. User sees loading screen with progress stages (Analyse, Recherche, Synthese)
3. User sees color-coded bias score as first visual element on results screen
4. User can tap to expand detailed bias signals and explanations
5. User sees 2-3 "Autres angles" cards with clickable links to alternative sources
6. User can open alternative sources in browser from result cards
7. First useful screen appears in <3s (loading screen with progress)

**Plans:** TBD

**UI hint:** yes

---

### Phase 4: Robustness & Polish

**Goal:** System handles errors gracefully and maintains performance under real-world conditions

**Depends on:** Phase 3

**Requirements:** ROB-01, ROB-02, ROB-03, ROB-04

**Success Criteria** (what must be TRUE):
1. System displays clear error messages for common failures (FETCH_FAILED, PAYWALL, TIMEOUT, NO_ARTICLE)
2. User can retry analysis when error is recoverable
3. System responds in <10s for P80 of requests (80th percentile)
4. System shows first useful screen (loading state) in <3s
5. System handles edge cases: invalid URLs, empty extractions, search failures, malformed LLM output
6. User receives partial results when some pipeline steps fail (degraded mode)

**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & API Scaffold | 0/0 | Not started | - |
| 2. Backend Pipeline | 1/3 | In progress | - |
| 3. Frontend & Integration | 0/0 | Not started | - |
| 4. Robustness & Polish | 0/0 | Not started | - |

---

## Notes

**Hackathon Context:**
This roadmap is optimized for 48h delivery. Each phase represents a major delivery milestone:
- Phase 1 (H0-H8): Scaffolding and contracts
- Phase 2 (H8-H20): Core analysis engine
- Phase 3 (H20-H36): User-facing experience
- Phase 4 (H36-H48): Hardening and demo prep

**Stack Decision:**
PROJECT.md indicates React PWA. This roadmap follows the React PWA approach for faster web deployment without app store friction.

**Performance Targets (updated after Phase 2 discussion):**
- P80 total time: <10s (2 LLM calls required)
- First screen: <3s (ROB-02)
- These targets drive parallelization decisions in backend pipeline

**Dependency Flow:**
Each phase builds on the previous:
1 -> 2: Mock API -> Real implementation
2 -> 3: Backend ready -> Frontend integration
3 -> 4: Working flow -> Production-ready

---

*Last updated: 2026-03-28 after Phase 2 planning*
