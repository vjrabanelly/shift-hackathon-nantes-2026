# Sprint 1 Plan

## Goal

Ship a clickable Chrome demo in 1.5 days that proves the full UI loop:

1. Capture a LinkedIn offer from the current tab.
2. Open a side panel with the selected offer.
3. Show a master resume area.
4. Save the offer into an application dashboard view.
5. Show interview prep and follow-up generation placeholders.
6. Export flow can be mocked if backend PDF is not ready.

---

## Scope To Keep

- Chrome only
- Side panel as the main product surface
- Mock-first UI with backend-ready API adapters
- One polished happy path

Do not build:

- Auto-apply
- Full profile CRUD for every entity in the backend schema
- Pixel-perfect PDF renderer in frontend
- Complex auth flow in the extension for the first demo

---

## Team Split

### Frontend UI subteam

- Extension shell
- Side panel routes
- Popup capture flow
- Mock state and API adapters
- Demo-grade UI polish

### Backend subteam

- Auth/session strategy
- Minimal routes for profile, jobs, generation, dashboard
- PDF generation endpoint
- Stable mock or real payload contracts

---

## Day 1 Morning

- Finalize the extension scaffold and commit the base structure.
- Implement side panel layout and four pages:
  - Master resume
  - Selected offer
  - Dashboard
  - Interview prep
- Implement popup action to capture the current LinkedIn offer and open the side panel.

Definition of done:

- Chrome extension loads locally.
- Popup opens.
- Side panel opens from popup.
- Captured offer is visible in UI with mocked fallback.

---

## Day 1 Afternoon

- Replace static view logic with local extension storage for captured job data.
- Add stronger LinkedIn DOM extraction fallback selectors.
- Align frontend types with backend payload names.
- Add generate buttons and loading states for:
  - Tailored resume
  - Cover letter
  - Follow-up email
  - Interview prep

Definition of done:

- Demo flow is navigable end-to-end.
- No dead screens.
- Buttons show intended action even if backend is mocked.

---

## Day 2 Morning

- Integrate the first available backend endpoints if ready.
- If backend is not ready, keep mocked adapters and focus on polish.
- Add PDF export entry point in UI:
  - `Generate PDF`
  - `Download latest PDF`
- Improve visual quality, copy, empty states, and error states.
- Rehearse the demo path on actual LinkedIn pages.

Definition of done:

- One stable demo script works in under 2 minutes.
- UI looks intentional, not default boilerplate.
- Every major click has a visible result.

---

## Frontend Task Order

1. Make the side panel flow reliable.
2. Make the captured offer visible and understandable.
3. Make the dashboard credible.
4. Make generation actions feel real.
5. Only then connect backend endpoints.

---

## Risks

- LinkedIn DOM may vary between pages, so job extraction must degrade gracefully.
- Manifest V3 side panel behavior can be fragile if messaging is unclear.
- PDF generation will likely depend on backend readiness.
- Auth can consume too much time if included too early.

---

## Demo Script

1. Open a LinkedIn offer.
2. Click the extension popup button.
3. Show the side panel loading the selected offer.
4. Move to the tailored resume action.
5. Save to dashboard.
6. Open interview prep.
7. Show follow-up email generation and PDF export action.
