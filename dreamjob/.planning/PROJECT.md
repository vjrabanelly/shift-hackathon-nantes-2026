# Dreamjob

## What This Is

Dreamjob Part 1 is a Master CV builder that converts one uploaded PDF resume into a structured, reviewable professional profile. The product helps unemployed users, recent graduates, and career changers build a complete source of truth for their career data before later matching and application workflows are added.

## Core Value

Capture the user's full professional history in a structured, high-quality format so future matching and tailored CV generation can rely on accurate source data.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can upload one PDF resume as the starting point for Master CV creation
- [ ] System extracts structured Master CV data with high accuracy and confidence-aware review
- [ ] User can review, confirm, edit, and complete all extracted profile sections
- [ ] User can manually add missing experiences, skills, projects, and certifications
- [ ] System shows completeness feedback and marks the Master CV complete when review requirements are met

### Out of Scope

- Job search and matching — belongs to a later product part
- Automated applications and recruiter messaging — belongs to a later product part
- Account creation and authentication — omitted for the proof of concept
- Multi-resume merge — v1 accepts only one recent resume
- DOCX support — v1 supports PDF only
- Advanced bullet tagging — deferred until later profile enrichment work

## Context

Dreamjob is being developed in parts. This project phase focuses exclusively on Building the Master CV. The Master CV is intended to become the single source of truth for later teams working on job search, matching, and automated applications.

The current v1 direction is not manual-only anymore. The product now starts from one uploaded PDF resume, performs automatic extraction, then asks the user to review and fix anything uncertain. Extraction accuracy is a core product requirement, but the UX must surface uncertainty instead of silently guessing.

The user flow begins directly at Master CV setup with no account creation. The user uploads a resume, reviews extracted sections, fills missing information, and reaches a "Master CV complete" state once the profile has been sufficiently reviewed.

## Constraints

- **Scope**: Part 1 only — the build must stay limited to the Master CV experience
- **Input Format**: PDF only — v1 accepts one uploaded PDF resume
- **Accuracy**: High-confidence extraction with review — uncertain fields must be confirmed or edited
- **UX**: Editable structured sections — the product is a source-of-truth builder, not a final resume designer
- **POC**: No auth — account creation is intentionally excluded from the proof of concept

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus v1 on Part 1 only | Keeps scope tight and builds the data foundation first | — Pending |
| Use one uploaded PDF as the source document | Simplifies extraction and avoids multi-resume merge complexity | — Pending |
| Require review of uncertain extraction results | Accuracy matters, but the system should not silently invent data | — Pending |
| Model one work experience per job with separate bullet items | Supports later resume tailoring and selective reuse of accomplishments | — Pending |
| Mark profile completion based on reviewed extracted sections | Completeness must reflect quality and readiness, not just saved data | — Pending |

---
*Last updated: 2026-03-28 after Part 1 product discovery*
