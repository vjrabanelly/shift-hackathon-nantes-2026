const DEFAULT_SERVER = "http://localhost:8081";
const TRACKING_INTERVAL_MS = 5000;
const MIN_MOVE_METERS = 20;

let currentCoords = null;
let lastFetchedCoords = null;
let trackingInterval = null;
let isTracking = false;
let serverUrl = DEFAULT_SERVER;
let radius = 500;

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GPS_UPDATE") {
    currentCoords = message.coords;
  }

  if (message.type === "START_TRACKING") {
    serverUrl = message.serverUrl;
    radius = message.radius;
    startTracking();
    sendResponse({ ok: true });
  }

  if (message.type === "STOP_TRACKING") {
    stopTracking();
    sendResponse({ ok: true });
  }

  if (message.type === "FETCH_POIS") {
    fetchPois(message.serverUrl, message.lat, message.lon, message.radius)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "FETCH_POI_AUDIO") {
    fetchPoiAudio(message.serverUrl, message.poi, message.lang)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function fetchPoiAudio(serverUrl, poi, lang) {
  const res = await fetch(`${serverUrl}/poi-audio?lang=${encodeURIComponent(lang)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(poi),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchPois(url, lat, lon, rad) {
  const res = await fetch(`${url}/pois?lat=${lat}&lon=${lon}&radius=${rad}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function sendToServer() {
  if (!currentCoords) return;
  const { lat, lon } = currentCoords;

  if (lastFetchedCoords) {
    const moved = haversineDistance(lastFetchedCoords.lat, lastFetchedCoords.lon, lat, lon);
    if (moved < MIN_MOVE_METERS) return;
  }
  lastFetchedCoords = { lat, lon };
  try {
    const data = await fetchPois(serverUrl, lat, lon, radius);
    // Notifie tous les onglets Google Maps ouverts
    chrome.tabs.query({ url: ["https://www.google.com/maps/*", "https://maps.google.com/*"] }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: "SERVER_RESPONSE", data }).catch(() => {});
      });
    });
  } catch (err) {
    chrome.tabs.query({ url: ["https://www.google.com/maps/*", "https://maps.google.com/*"] }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: "SERVER_ERROR", error: err.message }).catch(() => {});
      });
    });
  }
}

function startTracking() {
  if (trackingInterval) clearInterval(trackingInterval);
  isTracking = true;
  sendToServer();
  trackingInterval = setInterval(sendToServer, TRACKING_INTERVAL_MS);
  chrome.storage.local.set({ isTracking: true, serverUrl, radius });
}

function stopTracking() {
  if (trackingInterval) { clearInterval(trackingInterval); trackingInterval = null; }
  isTracking = false;
  lastFetchedCoords = null;
  chrome.storage.local.set({ isTracking: false });
}

// Restaure l'état au redémarrage du service worker
chrome.storage.local.get(["isTracking", "serverUrl", "radius"], (result) => {
  if (result.isTracking) {
    serverUrl = result.serverUrl || DEFAULT_SERVER;
    radius = result.radius || 500;
    startTracking();
  }
});
