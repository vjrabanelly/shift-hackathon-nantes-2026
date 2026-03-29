# Requirements: Dreamjob Part 1

**Defined:** 2026-03-28
**Core Value:** Capture the user's full professional history in a structured, high-quality format so future matching and tailored CV generation can rely on accurate source data.

## v1 Requirements

### Upload

- [ ] **UPLD-01**: User can upload one PDF resume as the input document for Master CV setup
- [ ] **UPLD-02**: System stores the uploaded PDF as a reference document for the Master CV

### Extraction

- [ ] **EXTR-01**: System extracts personal info from the uploaded PDF into structured fields
- [ ] **EXTR-02**: System extracts work experiences from the uploaded PDF into one experience entry per job
- [ ] **EXTR-03**: System extracts experience bullets as separate editable items, not one combined paragraph
- [ ] **EXTR-04**: System extracts education entries into structured fields
- [ ] **EXTR-05**: System extracts skills into structured items
- [ ] **EXTR-06**: System extracts certifications, projects, and achievements when present in the uploaded PDF
- [ ] **EXTR-07**: System records extraction confidence so uncertain fields can be reviewed explicitly

### Review And Editing

- [ ] **REVW-01**: User can review extracted personal info and confirm or edit each field
- [ ] **REVW-02**: User can review every extracted work experience and confirm or edit each entry
- [ ] **REVW-03**: User can review every extracted education entry and confirm or edit each entry
- [ ] **REVW-04**: User can review every extracted skill and confirm or edit each item
- [ ] **REVW-05**: Low-confidence extracted fields are highlighted in the UI
- [ ] **REVW-06**: A section remains unresolved until all extracted items in that section have been reviewed
- [ ] **REVW-07**: User can edit extracted values directly in structured forms

### Manual Completion

- [ ] **MANL-01**: User can manually add missing work experiences after extraction
- [ ] **MANL-02**: User can manually add missing skills after extraction
- [ ] **MANL-03**: User can manually add missing projects after extraction
- [ ] **MANL-04**: User can manually add missing certifications after extraction

### Completeness

- [ ] **CMPL-01**: System shows a progress bar for Master CV completion
- [ ] **CMPL-02**: System shows missing section warnings
- [ ] **CMPL-03**: System shows a profile strength score
- [ ] **CMPL-04**: System shows a checklist of incomplete or unresolved areas
- [ ] **CMPL-05**: Master CV can be marked complete only after personal info has been reviewed
- [ ] **CMPL-06**: Master CV can be marked complete only after all extracted work experiences have been reviewed
- [ ] **CMPL-07**: Master CV can be marked complete only after all extracted education entries have been reviewed
- [ ] **CMPL-08**: Master CV can be marked complete only after all extracted skills have been reviewed

## v2 Requirements

### Deferred

- **NEXT-01**: User can upload more than one resume and merge extracted content
- **NEXT-02**: System supports DOCX resume upload
- **NEXT-03**: System supports advanced tagging or categorization of experience bullets
- **NEXT-04**: System supports account creation and persistent user workspaces

## Out of Scope

| Feature | Reason |
|---------|--------|
| Job search and matching | This project phase covers only Master CV creation |
| Automated applications | This belongs to a later product part |
| Recruiter messaging flows | This belongs to a later product part |
| Browser extension flows | Not required for Part 1 proof of concept |
| Multi-resume merge | Too much complexity for the first Master CV slice |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UPLD-01 | Phase 1 | Pending |
| UPLD-02 | Phase 1 | Pending |
| EXTR-01 | Phase 1 | Pending |
| EXTR-02 | Phase 1 | Pending |
| EXTR-03 | Phase 1 | Pending |
| EXTR-04 | Phase 1 | Pending |
| EXTR-05 | Phase 1 | Pending |
| EXTR-06 | Phase 1 | Pending |
| EXTR-07 | Phase 2 | Pending |
| REVW-01 | Phase 2 | Pending |
| REVW-02 | Phase 2 | Pending |
| REVW-03 | Phase 2 | Pending |
| REVW-04 | Phase 2 | Pending |
| REVW-05 | Phase 2 | Pending |
| REVW-06 | Phase 2 | Pending |
| REVW-07 | Phase 2 | Pending |
| MANL-01 | Phase 3 | Pending |
| MANL-02 | Phase 3 | Pending |
| MANL-03 | Phase 3 | Pending |
| MANL-04 | Phase 3 | Pending |
| CMPL-01 | Phase 4 | Pending |
| CMPL-02 | Phase 4 | Pending |
| CMPL-03 | Phase 4 | Pending |
| CMPL-04 | Phase 4 | Pending |
| CMPL-05 | Phase 4 | Pending |
| CMPL-06 | Phase 4 | Pending |
| CMPL-07 | Phase 4 | Pending |
| CMPL-08 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 after Part 1 product discovery*
