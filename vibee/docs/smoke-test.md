# PartyJam Smoke Test Checklist

Run this checklist against the production deployment before opening the event to guests. Each step includes a quick-fix note if something goes wrong.

**Target URL:** `https://<YOUR_API_DOMAIN>` (set via Clever Cloud env `BASE_URL`)
**Web SPA URL:** `https://<YOUR_WEB_DOMAIN>`

---

## Step 1 — API Health Check

**Action:** `curl https://<API>/health`

**Expected:** `{"status":"ok","timestamp":"<ISO date>"}`

**Quick fix:** If timeout → Clever Cloud app not started; check the app status in CC console and tail logs. If 502 → Node process crashed on boot; check `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` env vars are set correctly.

---

## Step 2 — Create Event

**Action:** `POST https://<API>/events` with body `{"name":"Shift Party 2026"}`

**Expected:** `201` response with `event_id`, `admin_token`, `join_url`, `qr_url`.

**Quick fix:** If `500` → Supabase `events` table insert failed; verify Supabase URL and service key, check if DB migrations were applied (`supabase db push`). Save the `admin_token` and `event_id` — you'll need them for all subsequent steps.

---

## Step 3 — Guest Joins Event

**Action:** Open `<join_url>` (from step 2) in a browser. Enter a display name and submit.

**Expected:** Guest view loads showing event name and empty queue. No JS console errors. The guest appears in the event's guest count.

**Quick fix:** If page is blank → check `VITE_API_URL` is set to the correct API domain in the web build. If join request returns `404` → `event_id` is wrong or DB row was not committed; retry step 2.

---

## Step 4 — Request a Track

**Action:** As the guest, type a song name (e.g. "Daft Punk Around the World") and submit a track request.

**Expected:** Track appears in the queue with status `queued`. The `RequestInput` field clears after submit.

**Quick fix:** If request hangs → check API logs for YouTube resolution errors; essentia service may be unreachable. If track stays `resolving` for >30s → essentia container is down; `docker-compose logs essentia`. As a fallback, pre-seed known YouTube IDs directly via `POST /events/:id` with `seed_playlist`.

---

## Step 5 — Stream Starts & Track Plays

**Action:** In the admin view (`/admin/<event_id>?token=<admin_token>`), verify the Now Playing section shows the first track. Open the HLS stream URL `https://<API>/stream/playlist.m3u8` in VLC or a browser audio player.

**Expected:** Audio plays. `now_playing` is populated in `GET /events/:id`. Stream loads within 20s.

**Quick fix:** If no audio → ffmpeg failed to encode the track; check `docker-compose logs api` for ffmpeg errors. Verify `/tmp/partyjam/audio` is writable inside the container. If HLS 404 → stream directory not mounted; check `docker-compose.yml` volume for `/tmp/partyjam`.

---

## Step 6 — Realtime Queue Update

**Action:** From a second browser tab (guest view), request another track while the first is playing.

**Expected:** Queue updates in real time on the first tab without a page refresh. `guest_count` increments in admin view.

**Quick fix:** If no real-time update → Supabase Realtime may be blocked. Check `SUPABASE_URL` uses `wss://` for the realtime endpoint. The polling fallback (every 5s via `useRealtimeQueue` / `useNowPlaying`) should keep the UI eventually consistent even without WebSocket — confirm by waiting 5–10s.

---

## Step 7 — Emotion Joystick Moves the Queue

**Action:** In the guest view, drag the emotion joystick to a new position (high energy / positive valence corner).

**Expected:** `PATCH /events/:id/joystick` returns `200`. After ~5s (debounce), the queue reorders to surface higher-energy tracks.

**Quick fix:** If joystick patch returns `500` → `joystick_positions` table missing; run migrations. If queue doesn't reorder → QueueEngine debounce timer (5s) hasn't fired yet; wait and retry. If Essentia audio features were not computed, queue will fall back to FIFO order — this is acceptable.

---

## Step 8 — Admin Skip Track

**Action:** In the admin view, click the Skip button (or `POST /events/:id/skip` with header `x-admin-token: <token>`).

**Expected:** Current track moves to `played` status. Stream advances to next track. Now Playing updates to show the new track.

**Quick fix:** If skip returns `403` → admin token header not being sent; check the admin UI is reading the token from the URL query param. If stream doesn't advance → `StreamManager.advanceToNextTrack` failed; check ffmpeg process is still running (`ps aux | grep ffmpeg` inside container). Restart the stream by POSTing to create a new event as an absolute fallback.

---

## Checklist Summary

| # | Check | Pass? |
|---|-------|-------|
| 1 | API health endpoint returns `ok` | ☐ |
| 2 | Create event returns `201` with tokens | ☐ |
| 3 | Guest join works, view loads | ☐ |
| 4 | Track request queued successfully | ☐ |
| 5 | HLS stream plays audio | ☐ |
| 6 | Real-time queue updates (or 5s polling fallback) | ☐ |
| 7 | Joystick patch accepted, queue reorders | ☐ |
| 8 | Admin skip advances stream | ☐ |

**All 8 checks passed → ready to open the party 🎉**

If step 5 (stream) fails and can't be fixed in 10 min: fall back to running api + essentia locally on a dev laptop exposed via ngrok. Guests can still join, request tracks, and use the joystick — only the stream source changes.
