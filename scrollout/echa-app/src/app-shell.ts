import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, scrolloutDots } from './styles/theme.js';
import './components/scrollout-logo.js';
import {
  openInstagram,
  openInstagramProfile,
  openInstagramSearch,
  showInstagram,
  hideInstagram,
  isInstagramOpen,
  onSidebarRequest,
  onWrappedRequest,
} from './services/native-bridge.js';
import { startDaemon, getDaemonStatus } from './services/enrichment-daemon.js';

type Tab = 'home' | 'instagram' | 'scrollout' | 'cognition' | 'knowledge' | 'posts' | 'transparence' | 'settings';

@customElement('app-shell')
export class AppShell extends LitElement {
  static styles = [
    theme,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        height: 100dvh;
        background: var(--bg);
        color: var(--text);
      }

      /* ── FAB menu ── */
      .fab {
        position: fixed;
        top: 8px;
        left: 12px;
        width: 38px; height: 38px;
        border-radius: 10px;
        background: var(--surface2);
        border: 1px solid var(--border);
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 9998; padding: 0;
        color: var(--text);
        -webkit-tap-highlight-color: transparent;
        transition: opacity 0.2s ease, transform 0.15s ease;
      }
      .fab:active { transform: scale(0.92); background: var(--surface3); }
      .fab.open {
        opacity: 0;
        pointer-events: none;
      }
      .fab svg { width: 28px; height: 28px; }

      /* ── Sidebar ── */
      .backdrop {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.6);
        z-index: 10000;
        opacity: 0; pointer-events: none;
        transition: opacity 0.25s;
      }
      .backdrop.open { opacity: 1; pointer-events: auto; }

      .drawer {
        position: fixed; top: 0; left: 0; bottom: 0;
        width: 260px;
        background: var(--surface);
        z-index: 10001;
        transform: translateX(-100%);
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex; flex-direction: column;
        padding-top: 0;
      }
      .drawer.open { transform: translateX(0); }

      .drawer-head {
        display: flex; align-items: center; gap: 10px;
        padding: 20px 18px 16px;
        border-bottom: 1px solid var(--border);
      }
      .drawer-logo svg { width: 28px; height: 28px; }
      .drawer-brand {
        font-family: var(--font-heading);
        font-size: 18px; font-weight: 900;
        letter-spacing: 0.05em; text-transform: uppercase;
      }

      .drawer-nav {
        flex: 1; padding: 12px 0;
        display: flex; flex-direction: column; gap: 2px;
      }

      .nav-item {
        display: flex; align-items: center; gap: 14px;
        padding: 14px 20px;
        background: none; border: none;
        color: var(--text-dim);
        font-family: var(--font-body); font-size: 14px; font-weight: 500;
        cursor: pointer; text-align: left; width: 100%;
        -webkit-tap-highlight-color: transparent;
        transition: background 0.15s, color 0.15s;
        position: relative;
      }
      .nav-item:active { background: var(--surface2); }
      .nav-item.active {
        color: var(--accent);
        background: rgba(107,107,255,0.08);
      }
      .nav-item.active::before {
        content: ''; position: absolute; left: 0; top: 8px; bottom: 8px;
        width: 3px; border-radius: 0 3px 3px 0; background: var(--accent);
      }
      .nav-item .ico {
        width: 22px; height: 22px;
        display: flex; align-items: center; justify-content: center;
      }
      .nav-item .ico svg {
        width: 20px; height: 20px;
        stroke: currentColor; fill: none;
        stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round;
      }
      .nav-item .live {
        width: 7px; height: 7px; border-radius: 50%;
        background: var(--vert-menthe);
        box-shadow: 0 0 6px var(--vert-menthe);
        margin-left: auto;
      }

      .drawer-foot {
        padding: 16px 20px;
        border-top: 1px solid var(--border);
        font-family: var(--font-mono); font-size: 10px;
        color: var(--text-muted); letter-spacing: 0.05em;
      }

      /* ── Content ── */
      .screen {
        flex: 1; overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding-top: 48px;
      }

      /* ── Wrapped overlay ── */
      .wrapped-overlay {
        position: fixed; inset: 0; z-index: 10000;
        animation: fadeUp 0.4s cubic-bezier(0.4,0,0.2,1);
      }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* ── IG placeholder ── */
      .ig-wait {
        flex: 1; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 16px; padding: 20px; text-align: center;
        color: var(--text-dim); font-size: 13px;
      }
      .ig-wait .row { display: flex; gap: 6px; margin-bottom: 8px; }
      .ig-wait .row span {
        width: 8px; height: 8px; border-radius: 50%;
        animation: pulse 1.5s ease-in-out infinite;
      }
      .ig-wait .row span:nth-child(2) { animation-delay: .15s; }
      .ig-wait .row span:nth-child(3) { animation-delay: .3s; }
      .ig-wait .row span:nth-child(4) { animation-delay: .45s; }
      .ig-wait .row span:nth-child(5) { animation-delay: .6s; }
      .ig-wait .row span:nth-child(6) { animation-delay: .75s; }
      .ig-wait .row span:nth-child(7) { animation-delay: .9s; }
      .ig-wait .row span:nth-child(8) { animation-delay: 1.05s; }
      .ig-wait .row span:nth-child(9) { animation-delay: 1.2s; }
      @keyframes pulse {
        0%,100% { opacity: .3; transform: scale(.8); }
        50% { opacity: 1; transform: scale(1.2); }
      }
      .ig-wait h2 {
        font-family: var(--font-heading); font-size: 16px;
        font-weight: 700; color: var(--text); margin: 0;
      }
      .ig-wait p {
        font-size: 12px; color: var(--text-dim);
        max-width: 260px; line-height: 1.5; margin: 0;
      }
    `,
  ];

  @state() private tab: Tab = 'instagram';
  @state() private igOpen = false;
  @state() private wrapped = false;
  @state() private drawer = false;

  private sidebarHandle: { remove: () => Promise<void> } | null = null;
  private wrappedHandle: { remove: () => Promise<void> } | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.purgeAndRestart();
    this.bindSidebarEvent();
    this.bindWrappedEvent();
    this.autoLaunchInstagram();
  }

  private async autoLaunchInstagram() {
    try {
      await openInstagram();
      this.igOpen = true;
    } catch (e) {
      console.warn('[Scrollout] Auto-launch Instagram failed:', e);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.sidebarHandle?.remove();
    this.wrappedHandle?.remove();
  }

  private async bindSidebarEvent() {
    try {
      this.sidebarHandle = await onSidebarRequest(() => { void this.go('home'); });
    } catch { /* mock */ }
  }

  private async bindWrappedEvent() {
    try {
      this.wrappedHandle = await onWrappedRequest(() => { this.wrapped = true; });
    } catch { /* mock */ }
  }

  // ── Daemon ──

  private async purgeAndRestart() {
    const purged = localStorage.getItem('scrollout-purge-v6');
    if (!purged) {
      try {
        const plugin = (window as any).Capacitor?.Plugins?.InstaWebView;
        if (plugin?.purgeEmptyEnrichments) {
          const r = await plugin.purgeEmptyEnrichments();
          console.log(`[Scrollout] Purged ${r.deleted} empty enrichments`);
          localStorage.setItem('scrollout-purge-v6', 'done');
        }
      } catch {}
    }
    this.autoStartDaemon();
  }

  private autoStartDaemon() {
    if (getDaemonStatus().running) return;
    const envKey = import.meta.env.VITE_OPENAI_API_KEY || '';
    const apiKey = localStorage.getItem('scrollout-openai-key') || envKey;
    const rulesOnly = localStorage.getItem('scrollout-rules-only') === 'true';
    const interval = parseInt(localStorage.getItem('scrollout-daemon-interval') || '120');
    if (!localStorage.getItem('scrollout-openai-key') && envKey) {
      localStorage.setItem('scrollout-openai-key', envKey);
    }
    startDaemon({ intervalSec: interval, batchSize: 10, threshold: 1, apiKey, rulesOnly: rulesOnly && !apiKey });
  }

  // ── Nav ──

  private async closeDrawer() {
    this.drawer = false;
    // If we were on Instagram, re-show the WebView
    if (this.tab === 'instagram' && this.igOpen) {
      try { await showInstagram(); } catch {}
    }
  }

  private async go(t: Tab) {
    this.drawer = false;
    this.tab = t;
    if (t === 'instagram') {
      try {
        const s = await isInstagramOpen();
        s.open ? await showInstagram() : await openInstagram();
        this.igOpen = true;
      } catch (e) { console.warn('[Scrollout] IG error:', e); }
    } else if (this.igOpen) {
      try { await hideInstagram(); } catch {}
    }
  }

  private async launchPlaylist(ev: CustomEvent<{ username: string }>) {
    this.drawer = false;
    this.tab = 'instagram';
    try {
      const s = await isInstagramOpen();
      if (!s.open) {
        await openInstagram();
      } else {
        await showInstagram();
      }
      await openInstagramProfile(ev.detail.username);
      this.igOpen = true;
    } catch (e) {
      console.warn('[Scrollout] Playlist launch failed:', e);
    }
  }

  private async launchRadio(ev: CustomEvent<{ query: string }>) {
    this.drawer = false;
    this.tab = 'instagram';
    try {
      const s = await isInstagramOpen();
      if (!s.open) {
        await openInstagram();
      } else {
        await showInstagram();
      }
      await openInstagramSearch(ev.detail.query);
      this.igOpen = true;
    } catch (e) {
      console.warn('[Scrollout] Radio launch failed:', e);
    }
  }

  // ── SVG icons ──

  private icon(name: string) {
    const icons: Record<string, string> = {
      home:     '<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>',
      ig:       '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/>',
      bubble:   '<circle cx="12" cy="12" r="5" stroke-width="1.5"/><circle cx="12" cy="12" r="10" stroke-dasharray="3 3" stroke-width="1"/><circle cx="12" cy="4" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="5.5" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="5.5" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="20" r="1.5" fill="currentColor" stroke="none"/>',
      radio:    '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4"/><path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>',
      graph:    '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="12" cy="12" r="3"/><path d="M8.5 8.5l1 1M13.5 13.5l1 1M15.5 8.5l-1 1M8.5 15.5l1-1"/>',
      feed:     '<path d="M4 6h16M4 12h16M4 18h10"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
    };
    return html`<span class="ico"><svg viewBox="0 0 24 24" .innerHTML=${icons[name]}></svg></span>`;
  }

  private navItem(id: Tab, iconName: string, label: string, showLive = false) {
    return html`
      <button class="nav-item ${this.tab === id ? 'active' : ''}" @click=${() => this.go(id)}>
        ${this.icon(iconName)} ${label}
        ${showLive ? html`<span class="live"></span>` : ''}
      </button>
    `;
  }

  // ── Render ──

  render() {
    return html`
      ${this.wrapped ? html`
        <div class="wrapped-overlay">
          <screen-wrapped @close-wrapped=${() => { this.wrapped = false; }}></screen-wrapped>
        </div>
      ` : ''}

      <div class="backdrop ${this.drawer ? 'open' : ''}" @click=${() => this.closeDrawer()}></div>

      <div class="drawer ${this.drawer ? 'open' : ''}">
        <div class="drawer-head">
          <div class="drawer-logo"><scrollout-logo size="28"></scrollout-logo></div>
          <span class="drawer-brand">Scrollout</span>
        </div>
        <div class="drawer-nav">
          ${this.navItem('home', 'home', 'Profil')}
          ${this.navItem('instagram', 'ig', 'Instagram', this.igOpen)}
          ${this.navItem('scrollout', 'radio', 'Comprends ma bulle')}
          ${this.navItem('transparence', 'bubble', 'Transparence')}
          ${this.navItem('cognition', 'bubble', 'Bulle cognitive')}
          ${this.navItem('knowledge', 'graph', 'Univers')}
          ${this.navItem('posts', 'feed', 'Feed')}
          ${this.navItem('settings', 'settings', 'Configuration')}
        </div>
        <div class="drawer-foot">scrollout v0.9</div>
      </div>

      ${this.tab !== 'instagram' ? html`
        <button class="fab ${this.drawer ? 'open' : ''}" @click=${() => { this.drawer = !this.drawer; }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      ` : ''}

      <div class="screen">
        ${this.tab === 'home' ? html`
          <screen-home
            @instagram-opened=${() => { this.igOpen = true; this.tab = 'instagram'; }}
            @open-wrapped=${() => { this.wrapped = true; }}
            @open-transparence=${() => this.go('transparence')}
          ></screen-home>
        ` : ''}
        ${this.tab === 'transparence' ? html`
          <screen-transparence @go-home=${() => this.go('home')}></screen-transparence>
          <screen-enrichment></screen-enrichment>
        ` : ''}
        ${this.tab === 'instagram' ? html`
          <div class="ig-wait">
            <div class="row">${scrolloutDots.map(c => html`<span style="background:${c}"></span>`)}</div>
            <h2>Capture en cours</h2>
            <p>Parcourez votre fil Instagram normalement. Scrollout analyse chaque post en arriere-plan.</p>
          </div>
        ` : ''}
        ${this.tab === 'scrollout' ? html`
          <screen-scrollout
            @go-instagram=${() => this.go('instagram')}
            @open-wrapped=${() => { this.wrapped = true; }}
            @launch-playlist=${(ev: CustomEvent<{ username: string }>) => this.launchPlaylist(ev)}
            @launch-radio=${(ev: CustomEvent<{ query: string }>) => this.launchRadio(ev)}
          ></screen-scrollout>
        ` : ''}
        ${this.tab === 'cognition' ? html`<screen-cognition @go-home=${() => this.go('home')}></screen-cognition>` : ''}
        ${this.tab === 'knowledge' ? html`<screen-knowledge></screen-knowledge>` : ''}
        ${this.tab === 'posts' ? html`<screen-posts></screen-posts>` : ''}
        ${this.tab === 'settings' ? html`<screen-settings></screen-settings>` : ''}
      </div>
    `;
  }
}
