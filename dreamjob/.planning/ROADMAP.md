# Roadmap: Dreamjob Part 1

## Overview

This roadmap delivers the Master CV foundation for Dreamjob. The build starts by accepting one uploaded PDF resume and converting it into structured profile data, then adds a review-and-correction workflow, manual completion tools, and completeness logic so the user can reach a trusted "Master CV complete" state.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Upload And Extraction Foundation** - Accept one PDF resume, store it, and extract the Master CV structure
- [ ] **Phase 2: Review And Correction Flow** - Let the user review uncertain data and resolve extracted sections
- [ ] **Phase 3: Manual Completion Tools** - Let the user add missing structured profile data after extraction
- [ ] **Phase 4: Completeness And Readiness** - Show profile progress and determine when the Master CV is complete
- [ ] **Phase 5: POC Polish And Persistence** - Tighten navigation, validation, and persistence for the proof of concept

## Phase Details

### Phase 1: Upload And Extraction Foundation
**Goal**: User can upload one PDF resume, keep it as a reference, and receive an initial structured Master CV draft
**Depends on**: Nothing (first phase)
**Requirements**: [UPLD-01, UPLD-02, EXTR-01, EXTR-02, EXTR-03, EXTR-04, EXTR-05, EXTR-06]
**Success Criteria** (what must be TRUE):
  1. User can upload one PDF resume into the app
  2. The uploaded PDF is preserved as a reference asset
  3. The system produces structured draft data for personal info, experience, education, skills, and other supported sections
**Plans**: 3 plans

Plans:
- [ ] 01-01: Define Master CV schema and extraction output contract
- [ ] 01-02: Implement PDF upload and storage flow
- [ ] 01-03: Implement extraction pipeline and structured draft generation

### Phase 2: Review And Correction Flow
**Goal**: User can inspect extracted data, confirm or edit uncertain fields, and resolve required sections
**Depends on**: Phase 1
**Requirements**: [EXTR-07, REVW-01, REVW-02, REVW-03, REVW-04, REVW-05, REVW-06, REVW-07]
**Success Criteria** (what must be TRUE):
  1. Low-confidence fields are visibly highlighted in the review UI
  2. User can confirm or edit extracted items in structured forms
  3. Required sections remain unresolved until all extracted items are reviewed
**Plans**: 3 plans

Plans:
- [ ] 02-01: Model confidence and review status across extracted fields
- [ ] 02-02: Build section review interfaces for personal info, experience, education, and skills
- [ ] 02-03: Implement unresolved section and review completion logic

### Phase 3: Manual Completion Tools
**Goal**: User can add profile information that the extraction missed so the Master CV can become complete
**Depends on**: Phase 2
**Requirements**: [MANL-01, MANL-02, MANL-03, MANL-04]
**Success Criteria** (what must be TRUE):
  1. User can add missing experiences manually
  2. User can add missing skills, projects, and certifications manually
  3. Manually added entries integrate into the same structured Master CV model as extracted data
**Plans**: 2 plans

Plans:
- [ ] 03-01: Build add-new flows for missing profile entries
- [ ] 03-02: Integrate manual entries into section review and storage

### Phase 4: Completeness And Readiness
**Goal**: User understands what is missing and can reach a trustworthy "Master CV complete" state
**Depends on**: Phase 3
**Requirements**: [CMPL-01, CMPL-02, CMPL-03, CMPL-04, CMPL-05, CMPL-06, CMPL-07, CMPL-08]
**Success Criteria** (what must be TRUE):
  1. User sees progress, missing areas, and unresolved review items
  2. The app computes a profile strength score from current profile quality
  3. The Master CV can only be marked complete when required review rules are satisfied
**Plans**: 2 plans

Plans:
- [ ] 04-01: Implement completeness signals and readiness checklist
- [ ] 04-02: Implement Master CV completion rules and final state handling

### Phase 5: POC Polish And Persistence
**Goal**: The proof of concept feels coherent, recoverable, and ready for internal evaluation
**Depends on**: Phase 4
**Requirements**: []
**Success Criteria** (what must be TRUE):
  1. User can move through the Master CV sections without confusion
  2. Validation and save behavior are consistent across sections
  3. The profile draft can be reloaded without losing reviewed progress
**Plans**: 2 plans

Plans:
- [ ] 05-01: Improve section navigation and validation UX
- [ ] 05-02: Add persistence and reload behavior for the POC

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Upload And Extraction Foundation | 0/3 | Not started | - |
| 2. Review And Correction Flow | 0/3 | Not started | - |
| 3. Manual Completion Tools | 0/2 | Not started | - |
| 4. Completeness And Readiness | 0/2 | Not started | - |
| 5. POC Polish And Persistence | 0/2 | Not started | - |
