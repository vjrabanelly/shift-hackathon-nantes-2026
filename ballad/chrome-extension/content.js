const DEFAULT_SERVER = "http://localhost:8081";
const TRACKING_INTERVAL_MS = 5000;

let currentCoords = null;
let lastPois = [];
let trackingInterval = null;
let isTracking = false;
let serverUrl = DEFAULT_SERVER;
let radius = 500;

// ── Injection du widget ──────────────────────────────────────────────────────

function createWidget() {
  if (document.getElementById("ballad-widget")) return;

  const widget = document.createElement("div");
  widget.id = "ballad-widget";
  widget.innerHTML = `
    <div id="ballad-header">
      <span class="hb-title">Ballad</span>
      <span class="hb-toggle-icon">▾</span>
    </div>
    <div id="ballad-body">
      <div>
        <div class="hb-label">Position</div>
        <div class="hb-coords" id="hb-coords">En attente de coordonnées…</div>
      </div>
      <div class="hb-settings">
        <div class="hb-field">
          <div class="hb-label">Serveur</div>
          <input id="hb-server" type="text" value="${DEFAULT_SERVER}" />
        </div>
        <div class="hb-field" style="max-width:72px">
          <div class="hb-label">Rayon (m)</div>
          <input id="hb-radius" type="number" value="50" min="10" max="5000" />
        </div>
      </div>
      <button id="hb-btn" class="hb-btn start">Démarrer</button>
      <div class="hb-status" id="hb-status"></div>
      <div class="hb-pois" id="hb-pois" style="display:none">
        <div class="hb-label">POIs (<span id="hb-poi-count">0</span>)</div>
        <ul class="hb-poi-list" id="hb-poi-list"></ul>
      </div>
    </div>
  `;
  document.body.appendChild(widget);

  // Collapse/expand
  document.getElementById("ballad-header").addEventListener("click", () => {
    widget.classList.toggle("collapsed");
    document.querySelector("#ballad-header .hb-toggle-icon").textContent =
      widget.classList.contains("collapsed") ? "▸" : "▾";
  });

  // Bouton tracking
  document.getElementById("hb-btn").addEventListener("click", () => {
    serverUrl = document.getElementById("hb-server").value.trim() || DEFAULT_SERVER;
    radius = parseInt(document.getElementById("hb-radius").value) || 500;

    if (!isTracking) {
      startTracking();
    } else {
      stopTracking();
    }
  });

  // Charge la config sauvegardée
  chrome.storage.local.get(["isTracking", "serverUrl", "radius"], (result) => {
    if (result.serverUrl) document.getElementById("hb-server").value = result.serverUrl;
    if (result.radius)    document.getElementById("hb-radius").value = result.radius;
    if (result.isTracking) {
      serverUrl = result.serverUrl || DEFAULT_SERVER;
      radius    = result.radius    || 500;
      startTracking();
    }
  });
}

// ── GPS extraction ───────────────────────────────────────────────────────────

function extractCoordsFromUrl(url) {
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lon: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lon: parseFloat(qMatch[2]) };
  return null;
}

function updateCoords() {
  const coords = extractCoordsFromUrl(window.location.href);
  if (!coords) return;
  currentCoords = coords;
  const el = document.getElementById("hb-coords");
  if (el) el.textContent = `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`;
  // Notifie le background des nouvelles coords
  chrome.runtime.sendMessage({ type: "GPS_UPDATE", coords });
  // Recalcule distances/directions avec les POIs déjà en mémoire
  if (lastPois.length > 0) renderPois(lastPois);
}

// Écoute les réponses du background (POIs, erreurs)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SERVER_RESPONSE") {
    lastPois = message.data;
    renderPois(lastPois);
    setStatus(`Mis à jour — ${lastPois.length} POI(s)`);
  }
  if (message.type === "SERVER_ERROR") {
    setStatus(`Erreur: ${message.error}`, true);
  }
});

// Surveille les changements d'URL (SPA)
let lastUrl = window.location.href;
new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    updateCoords();
  }
}).observe(document.documentElement, { childList: true, subtree: true });

// ── Tracking ─────────────────────────────────────────────────────────────────

function startTracking() {
  isTracking = true;
  setBtn(true);
  setStatus("Tracking actif…");
  // Envoie coords + config au background qui fait le fetch (pas de restriction CORS)
  chrome.runtime.sendMessage({ type: "START_TRACKING", serverUrl, radius });
  // Met à jour les coords dans le background immédiatement
  if (currentCoords) {
    chrome.runtime.sendMessage({ type: "GPS_UPDATE", coords: currentCoords });
  }
}

function stopTracking() {
  isTracking = false;
  setBtn(false);
  setStatus("Tracking arrêté");
  chrome.runtime.sendMessage({ type: "STOP_TRACKING" });
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function setBtn(tracking) {
  const btn = document.getElementById("hb-btn");
  if (!btn) return;
  btn.textContent = tracking ? "Arrêter" : "Démarrer";
  btn.className = `hb-btn ${tracking ? "stop" : "start"}`;
}

function setStatus(msg, isError = false) {
  const el = document.getElementById("hb-status");
  if (!el) return;
  el.textContent = msg;
  el.className = `hb-status${isError ? " error" : ""}`;
}

// ── Calculs géo ──────────────────────────────────────────────────────────────

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // mètres
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingArrow(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  // 8 directions
  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  return arrows[Math.round(deg / 45) % 8];
}

function formatDistance(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

// ── Rendu POIs ────────────────────────────────────────────────────────────────

function renderPois(pois) {
  const section = document.getElementById("hb-pois");
  const list    = document.getElementById("hb-poi-list");
  const count   = document.getElementById("hb-poi-count");
  if (!section || !list || !count) return;

  count.textContent = pois.length;
  list.innerHTML = "";
  if (pois.length > 0) {
    section.style.display = "";
    pois.forEach((poi) => {
      const li = document.createElement("li");
      const hasCoords = currentCoords && poi.latitude != null && poi.longitude != null;
      const dist  = hasCoords ? haversineDistance(currentCoords.lat, currentCoords.lon, poi.latitude, poi.longitude) : null;
      const arrow = hasCoords ? bearingArrow(currentCoords.lat, currentCoords.lon, poi.latitude, poi.longitude) : "";
      li.innerHTML = `
        <div class="hb-poi-row">
          <div>
            <div class="hb-poi-name">${escapeHtml(poi.name)}</div>
            <div class="hb-poi-type">${escapeHtml(poi.type)}</div>
          </div>
          <div class="hb-poi-right">
            ${hasCoords ? `<div class="hb-poi-geo"><span class="hb-arrow">${arrow}</span><span class="hb-dist">${formatDistance(dist)}</span></div>` : ""}
            <button class="hb-play-btn" title="Générer et jouer l'audio">▶</button>
          </div>
        </div>
        <div class="hb-poi-audio-status"></div>
      `;
      li.querySelector(".hb-play-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        generatePoiAudio(li, poi);
      });
      if (poi.latitude != null && poi.longitude != null) {
        li.style.cursor = "pointer";
        li.addEventListener("click", () => {
          window.location.href = `https://www.google.com/maps?q=${poi.latitude},${poi.longitude}`;
        });
      }
      list.appendChild(li);
    });
  } else {
    section.style.display = "none";
  }
}

async function generatePoiAudio(li, poi) {
  const btn = li.querySelector(".hb-play-btn");
  const statusEl = li.querySelector(".hb-poi-audio-status");
  const server = document.getElementById("hb-server")?.value.trim() || serverUrl;

  btn.disabled = true;
  btn.textContent = "…";
  statusEl.textContent = "Génération…";
  statusEl.className = "hb-poi-audio-status";

  try {
    const response = await new Promise((resolve) =>
      chrome.runtime.sendMessage({
        type: "FETCH_POI_AUDIO",
        serverUrl: server,
        poi: { name: poi.name, lat: poi.latitude, lon: poi.longitude },
        lang: "fr",
      }, resolve)
    );
    if (!response.ok) throw new Error(response.error);
    const data = response.data;

    console.group(`[Ballad] POI audio — ${poi.name}`);
    console.log("Texte généré :", data.text);
    console.log("Modèle :", data.model);
    console.log("Coordonnées :", poi.latitude, poi.longitude);
    console.groupEnd();

    statusEl.textContent = data.text;

    if (data.audioBase64) {
      const audio = new Audio(`data:audio/mpeg;base64,${data.audioBase64}`);
      audio.play();
      btn.textContent = "▶";
      btn.disabled = false;
      btn.onclick = (e) => { e.stopPropagation(); audio.currentTime = 0; audio.play(); };
    } else {
      btn.textContent = "▶";
      btn.disabled = false;
    }
  } catch (err) {
    statusEl.textContent = `Erreur: ${err.message}`;
    statusEl.className = "hb-poi-audio-status error";
    btn.textContent = "▶";
    btn.disabled = false;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  createWidget();
  updateCoords();
}

// Tente l'injection immédiatement, puis repoll jusqu'à ce que ça marche
function tryInit() {
  if (document.body) {
    init();
  } else {
    const t = setInterval(() => {
      if (document.body) {
        clearInterval(t);
        init();
      }
    }, 100);
  }
}

tryInit();
