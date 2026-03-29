/**
 * InstaWebView plugin — Capacitor bridge to native Instagram WebView.
 *
 * Methods:
 *   openInstagram()    → { status }
 *   closeInstagram()   → { status }
 *   exportSession()    → { path, data }
 *   getCollectedData() → { count, data }
 *
 * Events:
 *   pageLoaded   → { url }
 *   trackerData  → { type, ... }
 */
(function() {
  'use strict';

  // Capacitor registers plugins on window.Capacitor.Plugins
  function getPlugin() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.InstaWebView) {
      return window.Capacitor.Plugins.InstaWebView;
    }
    // Fallback: mock for browser testing
    console.warn('[ECHA] InstaWebView plugin not available (running in browser?)');
    return {
      openInstagram: async () => ({ status: 'mock' }),
      closeInstagram: async () => ({ status: 'mock' }),
      exportSession: async () => ({ path: '', data: '{}' }),
      getCollectedData: async () => ({ count: 0, data: '[]' }),
      addListener: async () => ({ remove: async () => {} }),
      removeAllListeners: async () => {},
    };
  }

  window.EchaPlugin = {
    get native() { return getPlugin(); },

    async openInstagram() {
      return getPlugin().openInstagram();
    },

    async closeInstagram() {
      return getPlugin().closeInstagram();
    },

    async exportSession() {
      const result = await getPlugin().exportSession();
      return {
        path: result.path,
        data: typeof result.data === 'string' ? JSON.parse(result.data) : result.data,
      };
    },

    async getCollectedData() {
      const result = await getPlugin().getCollectedData();
      return {
        count: result.count,
        data: typeof result.data === 'string' ? JSON.parse(result.data) : result.data,
      };
    },

    async onPageLoaded(callback) {
      return getPlugin().addListener('pageLoaded', callback);
    },

    async onTrackerData(callback) {
      return getPlugin().addListener('trackerData', callback);
    },
  };
})();
