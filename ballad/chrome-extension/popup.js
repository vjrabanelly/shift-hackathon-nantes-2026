const DEFAULT_SERVER = "http://localhost:8081";

// --- POI Test ---
const poiNameInput = document.getElementById("poiName");
const poiLatInput = document.getElementById("poiLat");
const poiLonInput = document.getElementById("poiLon");
const poiLangSelect = document.getElementById("poiLang");
const generateBtn = document.getElementById("generateBtn");
const poiTestStatus = document.getElementById("poi-test-status");
const poiResult = document.getElementById("poi-result");
const poiTextEl = document.getElementById("poi-text");
const poiAudioEl = document.getElementById("poi-audio");

generateBtn.addEventListener("click", async () => {
  const name = poiNameInput.value.trim();
  const lat = parseFloat(poiLatInput.value);
  const lon = parseFloat(poiLonInput.value);
  const lang = poiLangSelect.value;
  const server = serverUrlInput.value.trim() || DEFAULT_SERVER;

  if (!name) { setPoiTestStatus("Nom du POI requis", true); return; }
  if (isNaN(lat) || isNaN(lon)) { setPoiTestStatus("Latitude et longitude requises", true); return; }

  generateBtn.disabled = true;
  setPoiTestStatus("Génération en cours…");
  poiResult.classList.add("hidden");

  try {
    const res = await fetch(`${server}/poi-audio?lang=${encodeURIComponent(lang)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, lat, lon }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    poiTextEl.textContent = data.text;
    if (data.audioBase64) {
      poiAudioEl.src = `data:audio/mpeg;base64,${data.audioBase64}`;
      poiAudioEl.style.display = "block";
      poiAudioEl.play();
    } else {
      poiAudioEl.style.display = "none";
    }
    poiResult.classList.remove("hidden");
    setPoiTestStatus("Audio généré !");
  } catch (err) {
    setPoiTestStatus(`Erreur: ${err.message}`, true);
  } finally {
    generateBtn.disabled = false;
  }
});

function setPoiTestStatus(msg, isError = false) {
  poiTestStatus.textContent = msg;
  poiTestStatus.className = isError ? "status error" : "status";
}


const coordsEl = document.getElementById("coords");
const toggleBtn = document.getElementById("toggleBtn");
const statusEl = document.getElementById("status");
const serverUrlInput = document.getElementById("serverUrl");
const radiusInput = document.getElementById("radius");
const poisSection = document.getElementById("pois-section");
const poiList = document.getElementById("poi-list");
const poiCount = document.getElementById("poi-count");

let isTracking = false;

// Charge la config sauvegardée
chrome.storage.local.get(["isTracking", "serverUrl", "radius", "lastCoords"], (result) => {
  serverUrlInput.value = result.serverUrl || DEFAULT_SERVER;
  radiusInput.value = result.radius || 500;
  if (result.lastCoords) {
    updateCoordsDisplay(result.lastCoords);
  }
  setTrackingState(result.isTracking || false);
});

// Écoute les messages du background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "COORDS_UPDATED") {
    updateCoordsDisplay(message.coords);
    chrome.storage.local.set({ lastCoords: message.coords });
  }
  if (message.type === "SERVER_RESPONSE") {
    updatePois(message.data);
    setStatus(`Mis à jour — ${message.data.length} POI(s)`);
  }
  if (message.type === "SERVER_ERROR") {
    setStatus(`Erreur serveur: ${message.error}`, true);
  }
});

toggleBtn.addEventListener("click", () => {
  const serverUrl = serverUrlInput.value.trim() || DEFAULT_SERVER;
  const radius = parseInt(radiusInput.value) || 500;

  if (!isTracking) {
    chrome.runtime.sendMessage({ type: "START_TRACKING", serverUrl, radius });
    setTrackingState(true);
    setStatus("Tracking démarré");
  } else {
    chrome.runtime.sendMessage({ type: "STOP_TRACKING" });
    setTrackingState(false);
    setStatus("Tracking arrêté");
  }
});

function updateCoordsDisplay(coords) {
  coordsEl.textContent = `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`;
}

function setTrackingState(tracking) {
  isTracking = tracking;
  if (tracking) {
    toggleBtn.textContent = "Arrêter le tracking";
    toggleBtn.className = "btn btn-stop";
  } else {
    toggleBtn.textContent = "Démarrer le tracking";
    toggleBtn.className = "btn btn-start";
  }
}

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "status error" : "status";
}

function updatePois(pois) {
  poiList.innerHTML = "";
  poiCount.textContent = pois.length;
  if (pois.length > 0) {
    poisSection.classList.remove("hidden");
    pois.forEach((poi) => {
      const li = document.createElement("li");
      li.innerHTML = `<div class="poi-name">${escapeHtml(poi.name)}</div><div class="poi-type">${escapeHtml(poi.type)}</div>`;
      poiList.appendChild(li);
    });
  } else {
    poisSection.classList.add("hidden");
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
