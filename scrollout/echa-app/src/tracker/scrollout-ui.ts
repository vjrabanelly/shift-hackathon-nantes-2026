/**
 * Scrollout UI overlay — injected into Instagram WebView.
 * - Adds Scrollout FAB with progress ring (charges as user scrolls)
 * - Shake animation when ring > 30%
 * - Firework burst at 100% to invite tap → opens Wrapped
 * - Hides "Utiliser l'application" / "Use the app" banners
 */
export {};

/** Mirror of palette from styles/theme.ts — hardcoded because this file runs in isolated WebView context */
const SCROLLOUT_COLORS = [
  '#FFFF66', '#90EE90', '#5B3FE8',
  '#FF6B00', '#DA70D6', '#8B22CC',
  '#FF0000', '#B0E0FF', '#90DDAA',
];

const BTN_ID = 'echa-scrollout-btn';
const FIREWORK_ID = 'echa-scrollout-firework';
const STYLE_ID = 'echa-scrollout-styles';

/** Number of posts needed to fully charge and trigger wrapped. */
const CHARGE_THRESHOLD = 15;

declare global {
  interface Window {
    EchaBridge?: {
      onData(json: string): void;
      [key: string]: unknown;
    };
    __SCROLLOUT_UI_LOADED?: boolean;
    __echaPostCount?: number;
  }
}

// ─── State ─────────────────────────────────────────────────

let currentProgress = 0; // 0→1
let isCharged = false;
let lastKnownPostCount = 0;
let chargeBaseCount = 0;  // post count at last charge reset (for repeating every 15)

// Blob deformation state
let scrollVelocity = 0;       // current velocity (px/frame)
let lastScrollY = 0;
let blobIntensity = 0;        // 0→1, smoothed deformation amount
let blobPhase = 0;            // rotation phase for organic movement
let blobRafId: number | null = null;
let scrollHeat = 0;           // 0→1, cumulative heat from scrolling (slow decay)

// ─── Kill Instagram chrome ──────────────────────────────────

function killAppBanner(): void {
  const bannerPatterns = /^(utiliser l.application|use the app|open app|ouvrir|get the app|t[ée]l[ée]charger)$/i;

  document.querySelectorAll<HTMLElement>('a, div, span, button').forEach(el => {
    const text = (el.textContent || '').trim();
    if (!bannerPatterns.test(text)) return;

    let container: HTMLElement = el;
    for (let i = 0; i < 6; i++) {
      const parent = container.parentElement;
      if (!parent || parent === document.body) break;
      const ps = getComputedStyle(parent);
      const rect = parent.getBoundingClientRect();
      if (ps.position === 'fixed' || ps.position === 'sticky' || rect.height < 70) {
        container = parent;
      } else {
        break;
      }
    }
    container.style.setProperty('display', 'none', 'important');
  });
}

function nukeIGChrome(): void {
  killAppBanner();
}

// ─── Inject CSS animations ─────────────────────────────────

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes echa-pulse-glow {
      0%, 100% { box-shadow: 0 0 10px 3px rgba(107,107,255,0.4), 0 2px 8px rgba(0,0,0,0.5); }
      50% { box-shadow: 0 0 22px 8px rgba(139,68,232,0.6), 0 2px 8px rgba(0,0,0,0.5); }
    }

    #${BTN_ID} {
      transition: border-radius 0.15s ease-out;
    }

    #${BTN_ID}.echa-charged {
      animation: echa-pulse-glow 1.8s ease-in-out infinite;
    }

    .echa-particle {
      position: absolute;
      width: 6px; height: 6px;
      border-radius: 50%;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

// ─── Scrollout logo SVG ─────────────────────────────────────

function createLogoSVG(): string {
  return `<svg width="28" height="28" viewBox="0 0 540 540" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M540 270C540 419.117 419.117 540 270 540C120.883 540 0 419.117 0 270C0 120.883 120.883 0 270 0C419.117 0 540 120.883 540 270Z" fill="white"/>
<path d="M375.996 269.424C376.38 331.49 345.296 379.381 270.465 378.998C189.877 378.615 163.781 334.938 163.014 269.807C162.246 207.741 193.33 161 269.697 161C344.913 161 375.613 208.124 375.996 269.424ZM309.224 269.424C309.224 239.157 299.63 213.105 270.465 213.488C237.846 213.871 229.403 239.157 229.403 270.19C229.403 301.607 238.613 326.893 270.465 326.51C299.63 326.127 309.607 300.84 309.224 269.424Z" fill="black" fill-opacity="0.9"/>
<path d="M399 167.053C399 180.133 388.396 190.737 375.316 190.737C362.235 190.737 351.632 180.133 351.632 167.053C351.632 153.972 362.235 143.368 375.316 143.368C388.396 143.368 399 153.972 399 167.053Z" fill="#8C43E9"/>
<path d="M351.632 144.316C351.632 151.118 346.118 156.632 339.316 156.632C332.514 156.632 327 151.118 327 144.316C327 137.514 332.514 132 339.316 132C346.118 132 351.632 137.514 351.632 144.316Z" fill="#FF6701"/>
</svg>`;
}

// ─── Progress Ring SVG ──────────────────────────────────────

// Ring removed — incandescent color replaces the progress indicator

// ─── Bubble burst ───────────────────────────────────────────
// Spawned on document.body to avoid compositing-layer clipping.
// Bubbles float up slowly with bouncy "blop" scale animation.

function spawnFirework(btn: HTMLElement): void {
  const existing = document.getElementById(FIREWORK_ID);
  if (existing) existing.remove();

  const rect = btn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const container = document.createElement('div');
  container.id = FIREWORK_ID;
  Object.assign(container.style, {
    position: 'fixed',
    top: '0', left: '0',
    width: '100vw', height: '100vh',
    pointerEvents: 'none',
    zIndex: '999999',
    overflow: 'visible',
  });

  // ── Wave 1: big bubbles (12, wide, slow) ──
  spawnBubbles(container, cx, cy, { count: 12, minDist: 50, maxDist: 140, minSize: 16, maxSize: 28, duration: 3000, delay: 0 });

  // ── Wave 2: medium bubbles (10, staggered) ──
  spawnBubbles(container, cx, cy, { count: 10, minDist: 25, maxDist: 90, minSize: 10, maxSize: 20, duration: 2600, delay: 300 });

  // ── Wave 3: tiny bubbles (8, close, fast blop) ──
  spawnBubbles(container, cx, cy, { count: 8, minDist: 10, maxDist: 50, minSize: 6, maxSize: 14, duration: 2200, delay: 600 });

  document.body.appendChild(container);
  setTimeout(() => container.remove(), 5000);
}

function spawnBubbles(
  container: HTMLElement,
  cx: number, cy: number,
  opts: { count: number; minDist: number; maxDist: number; minSize: number; maxSize: number; duration: number; delay: number },
): void {
  for (let i = 0; i < opts.count; i++) {
    const bubble = document.createElement('span');
    bubble.className = 'echa-particle';
    const angle = (360 / opts.count) * i + (Math.random() - 0.5) * 30;
    const distance = opts.minDist + Math.random() * (opts.maxDist - opts.minDist);
    const rad = (angle * Math.PI) / 180;
    const tx = Math.cos(rad) * distance;
    // Bubbles float upward: negative ty bias
    const ty = Math.sin(rad) * distance - (30 + Math.random() * 60);
    const color = SCROLLOUT_COLORS[i % SCROLLOUT_COLORS.length];
    const size = opts.minSize + Math.random() * (opts.maxSize - opts.minSize);
    const delay = opts.delay + Math.random() * 400;
    // Slight horizontal wobble
    const wobble = (Math.random() - 0.5) * 20;

    Object.assign(bubble.style, {
      position: 'fixed',
      width: `${size}px`, height: `${size}px`,
      background: color,
      left: `${cx - size / 2}px`, top: `${cy - size / 2}px`,
      borderRadius: '50%',
      opacity: '0',
    });

    requestAnimationFrame(() => {
      // Blop: scale 0 → overshoot 1.4 → settle 1 → float away → pop
      bubble.animate([
        { transform: 'translate(0, 0) scale(0)', opacity: '0' },
        { transform: 'translate(0, 0) scale(1.5)', opacity: '0.95', offset: 0.08 },
        { transform: 'translate(0, 0) scale(0.85)', opacity: '0.9', offset: 0.15 },
        { transform: `translate(${wobble}px, -5px) scale(1.1)`, opacity: '0.9', offset: 0.22 },
        { transform: `translate(${tx * 0.4 + wobble}px, ${ty * 0.4}px) scale(1)`, opacity: '0.85', offset: 0.5 },
        { transform: `translate(${tx * 0.8}px, ${ty * 0.8}px) scale(1.15)`, opacity: '0.6', offset: 0.8 },
        { transform: `translate(${tx}px, ${ty}px) scale(1.4)`, opacity: '0' },
      ], {
        duration: opts.duration + Math.random() * 800,
        delay,
        easing: 'ease-in-out',
        fill: 'forwards',
      });
    });

    container.appendChild(bubble);
  }
}

// ─── FAB creation ───────────────────────────────────────────

function createButton(): HTMLElement {
  const btn = document.createElement('div');
  btn.id = BTN_ID;
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', 'Menu Scrollout');
  Object.assign(btn.style, {
    position: 'relative',
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    background: '#262626',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: '0',
    padding: '0',
    WebkitTapHighlightColor: 'transparent',
    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
  });

  // Logo container (centered above ring)
  const logoWrap = document.createElement('div');
  Object.assign(logoWrap.style, {
    width: '28px', height: '28px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', zIndex: '2',
  });
  logoWrap.innerHTML = createLogoSVG();
  btn.appendChild(logoWrap);

  btn.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      if (isCharged) {
        // Charged → replay bubble animation, don't navigate
        const b = document.getElementById(BTN_ID);
        if (b) spawnFirework(b);
      } else {
        // Normal → open sidebar
        window.EchaBridge?.onData(JSON.stringify({ type: 'open_sidebar' }));
      }
    } catch { /* */ }
  });

  return btn;
}

// ─── Update ring progress ───────────────────────────────────

/** How many times to plop when threshold is reached */
const PLOP_COUNT = 3;
/** Delay between each plop (ms) */
const PLOP_INTERVAL = 5500;

function updateProgress(progress: number): void {
  const btn = document.getElementById(BTN_ID);
  if (!btn) return;

  const clamped = Math.min(1, Math.max(0, progress));
  currentProgress = clamped;

  // Charged state: plop 3 times then pause until next 15 posts
  if (clamped >= 1 && !isCharged) {
    isCharged = true;
    btn.classList.add('echa-charged');
    btn.setAttribute('aria-label', 'Voir votre Wrapped Scrollout');
    logDebug(`Charged! ${CHARGE_THRESHOLD} posts reached — plopping ${PLOP_COUNT}x`);

    // Plop 3 times with intervals
    spawnFirework(btn);
    for (let i = 1; i < PLOP_COUNT; i++) {
      setTimeout(() => {
        const b = document.getElementById(BTN_ID);
        if (b) spawnFirework(b);
      }, PLOP_INTERVAL * i);
    }

    // After all plops, reset charge so it recharges for the next 15 posts
    setTimeout(() => {
      resetCharge();
      // Keep lastKnownPostCount so next threshold is current + 15
      lastKnownPostCount = window.__echaPostCount || 0;
      chargeBaseCount = lastKnownPostCount;
      logDebug(`Plop cycle done — next trigger at ${lastKnownPostCount + CHARGE_THRESHOLD} posts`);
    }, PLOP_INTERVAL * PLOP_COUNT + 1000);
  }
}

// ─── Incandescent color ramp ────────────────────────────────

/**
 * Maps progress (0→1) to a heat color: black → dark red → red → orange → yellow → white.
 * Like metal heating up.
 */
function incandescent(progress: number): string {
  const p = Math.min(1, Math.max(0, progress));

  // Color stops: [progress, r, g, b]
  // Shorter ramp — stays dark longer, heats up in the last stretch
  const stops: [number, number, number, number][] = [
    [0.00, 38,  38,  38 ],  // #262626 dark
    [0.40, 55,  35,  30 ],  // barely warm (stays dark a long time)
    [0.60, 100, 35,  15 ],  // dark ember
    [0.75, 170, 55,  10 ],  // red glow
    [0.85, 220, 130, 20 ],  // orange
    [0.95, 250, 220, 120],  // yellow
    [1.00, 255, 250, 230],  // white-hot
  ];

  // Find the two stops to interpolate between
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i][0] && p <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }

  const range = hi[0] - lo[0] || 1;
  const t = (p - lo[0]) / range;
  const r = Math.round(lo[1] + (hi[1] - lo[1]) * t);
  const g = Math.round(lo[2] + (hi[2] - lo[2]) * t);
  const b = Math.round(lo[3] + (hi[3] - lo[3]) * t);

  return `rgb(${r},${g},${b})`;
}

// ─── Blob deformation engine ────────────────────────────────

/**
 * Generate organic blob border-radius from intensity (0→1) and phase angle.
 * At 0: perfect circle. At 1: maximum organic distortion.
 */
function blobRadius(intensity: number, phase: number): string {
  if (intensity < 0.01) return '50%';

  const i = Math.min(1, intensity);
  // 8 control points — amplitude up to ±35% from center (very visible deformation)
  const offsets = [
    Math.sin(phase) * 35,
    Math.cos(phase * 1.3 + 1) * 30,
    Math.sin(phase * 0.9 + 2) * 38,
    Math.cos(phase * 1.1 + 3) * 32,
    Math.sin(phase * 1.2 + 0.5) * 33,
    Math.cos(phase * 0.8 + 1.5) * 36,
    Math.sin(phase * 1.4 + 2.5) * 28,
    Math.cos(phase * 1.1 + 3.5) * 34,
  ];

  const vals = offsets.map(o => Math.round(50 + o * i));
  return `${vals[0]}% ${vals[1]}% ${vals[2]}% ${vals[3]}% / ${vals[4]}% ${vals[5]}% ${vals[6]}% ${vals[7]}%`;
}

function startBlobLoop(): void {
  if (blobRafId !== null) return;

  lastScrollY = window.scrollY || window.pageYOffset || 0;

  function tick() {
    const btn = document.getElementById(BTN_ID);
    if (!btn || btn.dataset.hidden === '1') {
      blobRafId = requestAnimationFrame(tick);
      return;
    }

    // Measure scroll velocity
    const currentY = window.scrollY || window.pageYOffset || 0;
    const delta = Math.abs(currentY - lastScrollY);
    lastScrollY = currentY;
    scrollVelocity = delta;

    // Target intensity: map velocity to 0→1 (25px+=max deformation — very responsive)
    const targetIntensity = Math.min(1, delta / 25);

    // Smooth: ramp up FAST (0.5), decay slow (0.05) — feels springy
    if (targetIntensity > blobIntensity) {
      blobIntensity += (targetIntensity - blobIntensity) * 0.5;
    } else {
      blobIntensity += (targetIntensity - blobIntensity) * 0.05;
    }

    // Always deform when scrolling — no gate on progress
    // Phase advances faster when scrolling fast
    blobPhase += 0.06 + blobIntensity * 0.25;

    const radius = blobRadius(blobIntensity, blobPhase);
    btn.style.borderRadius = radius;

    // Scale bump: up to +18% when scrolling hard
    const scale = 1 + blobIntensity * 0.18;
    if (!isCharged) {
      btn.style.transform = `scale(${scale.toFixed(3)})`;
    }

    // Accumulate scroll heat: scrolling adds heat, decays slowly
    // Builds up over ~20-30s of sustained scrolling
    scrollHeat = Math.min(1, scrollHeat + delta * 0.0003);
    // Very slow decay when idle (~15s to cool down noticeably)
    if (delta < 2) {
      scrollHeat = Math.max(0, scrollHeat - 0.001);
    }

    // Incandescent: use the MAX of scroll heat and post-based progress
    const heatLevel = Math.max(scrollHeat, currentProgress);
    btn.style.background = incandescent(heatLevel);

    // Firework only triggers via post count (updateProgress), not scroll heat

    blobRafId = requestAnimationFrame(tick);
  }

  blobRafId = requestAnimationFrame(tick);
}

function resetCharge(): void {
  isCharged = false;
  currentProgress = 0;
  scrollHeat = 0;

  const btn = document.getElementById(BTN_ID);
  if (btn) {
    btn.classList.remove('echa-charged');
    btn.setAttribute('aria-label', 'Menu Scrollout');
  }
}

// ─── Poll tracker post count ────────────────────────────────

function pollPostCount(): void {
  const count = window.__echaPostCount || 0;
  if (count <= lastKnownPostCount) return;

  lastKnownPostCount = count;
  // Progress relative to last charge base (repeats every CHARGE_THRESHOLD posts)
  const sinceLast = count - chargeBaseCount;
  const progress = sinceLast / CHARGE_THRESHOLD;
  updateProgress(progress);
}

// ─── Injection ──────────────────────────────────────────────

function injectScrolloutButton(): void {
  const existing = document.getElementById(BTN_ID);
  if (existing && document.body.contains(existing)) return;
  if (existing) existing.remove();

  injectStyles();
  const btn = createButton();

  Object.assign(btn.style, {
    position: 'fixed',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 58px)',
    right: '6px',
    zIndex: '99999',
  });
  document.body.appendChild(btn);

  // Restore progress if tracker already counted posts
  const count = window.__echaPostCount || 0;
  if (count > 0) {
    lastKnownPostCount = count;
    updateProgress(count / CHARGE_THRESHOLD);
  }

  logDebug('FAB injected with progress ring');
}

// ─── Main ───────────────────────────────────────────────────

function logDebug(msg: string): void {
  console.log('[Scrollout] ' + msg);
  try {
    window.EchaBridge?.onData(JSON.stringify({ type: 'scrollout_debug', msg }));
  } catch { /* */ }
}

function init(): void {
  if (window.__SCROLLOUT_UI_LOADED) return;
  window.__SCROLLOUT_UI_LOADED = true;

  logDebug('UI script loaded, waiting for IG render...');

  // Initial injection after a short delay (let IG render)
  setTimeout(() => {
    nukeIGChrome();
    injectScrolloutButton();
  }, 1500);

  // Retry injection a few times in case IG DOM is slow
  setTimeout(() => {
    if (!document.getElementById(BTN_ID)) {
      logDebug('Retry injection at 3s...');
      injectScrolloutButton();
    }
  }, 3000);

  setTimeout(() => {
    if (!document.getElementById(BTN_ID)) {
      logDebug('Retry injection at 6s...');
      injectScrolloutButton();
    }
  }, 6000);

  // Poll post count every second to update ring
  setInterval(pollPostCount, 1000);

  // Start blob deformation loop (runs on rAF)
  startBlobLoop();

  // Periodic check: re-kill IG chrome + ensure button is visible
  setInterval(() => {
    nukeIGChrome();
    const existing = document.getElementById(BTN_ID);
    if (!existing || !document.body.contains(existing)) {
      if (existing) existing.remove();
      injectScrolloutButton();
    }
    // Hide FAB in stories/reels with bounce-out, show on feed with bounce-in
    const btn = document.getElementById(BTN_ID);
    if (btn) {
      const url = window.location.href;
      const isFullscreen = url.includes('/stories/') || url.includes('/reels/') || url.includes('/reel/') || url.includes('/p/');
      const isHidden = btn.dataset.hidden === '1';
      if (isFullscreen && !isHidden) {
        btn.dataset.hidden = '1';
        btn.style.pointerEvents = 'none';
        btn.style.transition = 'transform 0.15s cubic-bezier(0, 0, 0.2, 1.6), opacity 0.15s ease';
        btn.style.transform = 'scale(1.2) translateY(-12px)';
        setTimeout(() => {
          btn.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease';
          btn.style.transform = 'scale(0) translateY(30px)';
          btn.style.opacity = '0';
        }, 150);
      } else if (!isFullscreen && isHidden) {
        btn.dataset.hidden = '0';
        btn.style.pointerEvents = '';
        btn.style.transition = 'transform 0.35s cubic-bezier(0, 0, 0.2, 1.4), opacity 0.25s ease';
        btn.style.transform = 'scale(1) translateY(0)';
        btn.style.opacity = '1';
      }
    }
  }, 2000);

  // Re-inject button if removed (IG DOM mutations)
  new MutationObserver(() => {
    const existing = document.getElementById(BTN_ID);
    if (!existing || !document.body.contains(existing)) {
      if (existing) existing.remove();
      injectScrolloutButton();
    }
    nukeIGChrome();
  }).observe(document.body, { childList: true, subtree: true });
}

// ─── Exports for testing ────────────────────────────────────

export const __test__ = {
  CHARGE_THRESHOLD,
  resetCharge,
  pollPostCount,
  incandescent,
  blobRadius,
  get currentProgress() { return currentProgress; },
  get isCharged() { return isCharged; },
  get blobIntensity() { return blobIntensity; },
};

init();
