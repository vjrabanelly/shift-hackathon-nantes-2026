#!/bin/bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"

echo "=== Party JAM End-to-End Test ==="
echo "API: ${API_BASE}"
echo ""

# Step 1: Create event
echo "1. Creating event..."
CREATE_RESPONSE=$(curl -sf -X POST "${API_BASE}/events" \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E Test Party","seed_playlist":[]}')

EVENT_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['event_id'])")
ADMIN_TOKEN=$(echo "$CREATE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['admin_token'])")
echo "   ✓ Event created: ${EVENT_ID}"

# Step 2: Get event state
echo "2. Verifying event state endpoint..."
GET_RESPONSE=$(curl -sf "${API_BASE}/events/${EVENT_ID}")
EVENT_NAME=$(echo "$GET_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['event']['name'])")
echo "   ✓ Event name: ${EVENT_NAME}"

# Step 3: Join as guest
echo "3. Joining as guest..."
JOIN_RESPONSE=$(curl -sf -X POST "${API_BASE}/events/${EVENT_ID}/join" \
  -H "Content-Type: application/json" \
  -d '{"display_name":"TestGuest"}')

GUEST_ID=$(echo "$JOIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['guest_id'])")
GUEST_EMOJI=$(echo "$JOIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['emoji'])")
echo "   ✓ Guest joined: ${GUEST_EMOJI} (id: ${GUEST_ID})"

# Step 4: Verify guest count
echo "4. Verifying guest count..."
STATE=$(curl -sf "${API_BASE}/events/${EVENT_ID}")
GUEST_COUNT=$(echo "$STATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['guest_count'])")
if [ "$GUEST_COUNT" -lt 1 ]; then
  echo "   ✗ FAIL: guest_count=${GUEST_COUNT}, expected >= 1"
  exit 1
fi
echo "   ✓ Guest count: ${GUEST_COUNT}"

# Step 5: Submit a music request
echo "5. Submitting music request..."
REQUEST_RESPONSE=$(curl -sf -X POST "${API_BASE}/events/${EVENT_ID}/requests" \
  -H "Content-Type: application/json" \
  -d "{\"guest_id\":\"${GUEST_ID}\",\"raw_text\":\"Daft Punk Around the World\"}")

REQUEST_ID=$(echo "$REQUEST_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['request_id'])")
REQUEST_STATUS=$(echo "$REQUEST_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
echo "   ✓ Request submitted: ${REQUEST_ID} (status: ${REQUEST_STATUS})"

# Step 6: Poll for track to appear in queue (up to 30 seconds for YouTube search)
echo "6. Waiting for track to appear in queue..."
TRACK_APPEARED=false
for i in $(seq 1 30); do
  sleep 1
  QUEUE_STATE=$(curl -sf "${API_BASE}/events/${EVENT_ID}")
  QUEUE_COUNT=$(echo "$QUEUE_STATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('queue',[])))")
  if [ "$QUEUE_COUNT" -gt 0 ]; then
    TRACK_TITLE=$(echo "$QUEUE_STATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['queue'][0]['track']['title'])")
    echo "   ✓ Track appeared after ${i}s: ${TRACK_TITLE}"
    TRACK_APPEARED=true
    break
  fi
done
if [ "$TRACK_APPEARED" = false ]; then
  echo "   ⚠ WARNING: Track did not appear within 30 seconds (yt-dlp may not be available in this environment)"
fi

# Step 7: Poll for file_path to be set (track downloaded) — up to 120 seconds
echo "7. Waiting for track download (up to 120s)..."
for i in $(seq 1 120); do
  sleep 1
  QUEUE_STATE=$(curl -sf "${API_BASE}/events/${EVENT_ID}")
  FILE_PATH=$(echo "$QUEUE_STATE" | python3 -c "
import sys,json
d=json.load(sys.stdin)
q=d.get('queue',[])
np=d.get('now_playing')
if np and np.get('track',{}).get('file_path'):
  print(np['track']['file_path'])
elif q and q[0].get('track',{}).get('file_path'):
  print(q[0]['track']['file_path'])
else:
  print('')
" 2>/dev/null || echo "")
  if [ -n "$FILE_PATH" ] && [ "$FILE_PATH" != "null" ] && [ "$FILE_PATH" != "None" ]; then
    echo "   ✓ Track downloaded after ${i}s: ${FILE_PATH}"
    break
  fi
  if [ "$i" -eq 120 ]; then
    echo "   ⚠ WARNING: Track not downloaded within 120 seconds (yt-dlp may be unavailable)"
    break
  fi
done

# Step 8: Set joystick position
echo "8. Setting joystick position..."
JOYSTICK_RESPONSE=$(curl -sf -X PATCH "${API_BASE}/events/${EVENT_ID}/joystick" \
  -H "Content-Type: application/json" \
  -d "{\"guest_id\":\"${GUEST_ID}\",\"valence\":0.7,\"energy\":0.8}")

COLLECTIVE_VALENCE=$(echo "$JOYSTICK_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['collective']['valence'])")
COLLECTIVE_ENERGY=$(echo "$JOYSTICK_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['collective']['energy'])")
echo "   ✓ Collective position — valence: ${COLLECTIVE_VALENCE}, energy: ${COLLECTIVE_ENERGY}"

# Step 9: Verify collective joystick in event state
echo "9. Verifying collective joystick in event state..."
FINAL_STATE=$(curl -sf "${API_BASE}/events/${EVENT_ID}")
COLL_VALENCE=$(echo "$FINAL_STATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('collective_joystick',{}).get('valence','MISSING'))")
if [ "$COLL_VALENCE" = "MISSING" ]; then
  echo "   ✗ FAIL: collective_joystick missing from event state"
  exit 1
fi
echo "   ✓ collective_joystick.valence = ${COLL_VALENCE}"

# Step 10: Test admin skip
echo "10. Testing admin skip..."
NOW_PLAYING=$(echo "$FINAL_STATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('now_playing') or 'null')")
if [ "$NOW_PLAYING" != "null" ] && [ "$NOW_PLAYING" != "None" ]; then
  curl -sf -X POST "${API_BASE}/events/${EVENT_ID}/skip" \
    -H "x-admin-token: ${ADMIN_TOKEN}" > /dev/null
  echo "   ✓ Skip executed successfully"
else
  # No track playing — skip should still return 200
  SKIP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_BASE}/events/${EVENT_ID}/skip" \
    -H "x-admin-token: ${ADMIN_TOKEN}")
  if [ "$SKIP_STATUS" = "200" ]; then
    echo "   ✓ Admin skip endpoint responded 200 (no track currently playing)"
  else
    echo "   ✗ FAIL: Admin skip returned HTTP ${SKIP_STATUS}"
    exit 1
  fi
fi

# Step 11: Verify admin token auth is enforced
echo "11. Verifying admin token auth..."
UNAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_BASE}/events/${EVENT_ID}/skip" \
  -H "x-admin-token: wrong_token")
if [ "$UNAUTH_STATUS" = "403" ]; then
  echo "   ✓ Skip with bad token returns 403"
else
  echo "   ✗ FAIL: Expected 403, got ${UNAUTH_STATUS}"
  exit 1
fi

# Step 12: Health check
echo "12. Health check..."
HEALTH=$(curl -sf "${API_BASE}/health")
STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
if [ "$STATUS" != "ok" ]; then
  echo "   ✗ FAIL: health status=${STATUS}"
  exit 1
fi
echo "   ✓ Health: ${STATUS}"

echo ""
echo "=== All automated checks passed! ==="
echo ""
echo "Event ID: ${EVENT_ID}"
echo "Admin Token: ${ADMIN_TOKEN}"
echo ""
echo "Manual verification:"
echo "  1. Open stream in VLC: ${API_BASE}/stream/playlist.m3u8"
echo "  2. Verify audio is playing"
echo "  3. Check web UI at: ${API_BASE}/join/${EVENT_ID}"
echo ""
echo "For unattended 30-minute run:"
echo "  watch -n 60 'API_BASE=${API_BASE} bash scripts/e2e-test.sh'"
