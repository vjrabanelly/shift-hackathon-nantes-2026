/**
 * ECHA Image Analyzer — Bridge JS vers ML Kit
 * Crop l'image du post, dédup via URL, envoie à ML Kit
 */

const ImageAnalyzer = {
  _analyzedUrls: new Set(),

  /**
   * Crop une image du DOM en base64 via canvas
   * Ne prend que la zone de l'image (pas le header/footer du post)
   * @param {HTMLImageElement} imgElement
   * @returns {Promise<{base64: string, crop: {x: number, y: number, w: number, h: number}}>}
   */
  async cropImageToBase64(imgElement) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        resolve({
          base64,
          crop: { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }
        });
      };
      img.onerror = () => reject(new Error('Failed to load image for crop'));
      img.src = imgElement.src;
    });
  },

  /**
   * Analyse une image d'un post Instagram
   * - Crop automatique (canvas, uniquement l'image)
   * - Dédup via URL (skip si déjà analysé)
   * @param {HTMLImageElement} imgElement - L'élément <img> du post
   * @returns {Promise<{labels: Array, text: string, skipped: boolean}>}
   */
  async analyzePostImage(imgElement) {
    const imageUrl = imgElement.src || '';

    // Dédup côté JS (rapide, pas d'appel natif)
    if (this._analyzedUrls.has(imageUrl)) {
      return { skipped: true, reason: 'already_analyzed', imageUrl };
    }

    try {
      const { base64 } = await this.cropImageToBase64(imgElement);
      this._analyzedUrls.add(imageUrl);

      if (window.Capacitor && window.Capacitor.Plugins.ImageAnalyzer) {
        return await window.Capacitor.Plugins.ImageAnalyzer.analyzeImage({
          image: base64,
          imageUrl: imageUrl
        });
      }

      // Mock pour tests navigateur
      console.warn('[ImageAnalyzer] Plugin non disponible, mode mock');
      return {
        success: true,
        skipped: false,
        labels: [{ text: 'mock_label', confidence: 95 }],
        text: ''
      };
    } catch (e) {
      console.error('[ImageAnalyzer] Crop/analyze failed:', e);
      return { skipped: false, success: false, error: e.message };
    }
  },

  /**
   * Analyse toutes les images d'un article (post Instagram)
   * Filtre les petites images (profil pics, icônes)
   * @param {HTMLElement} article - L'élément <article> du post
   * @returns {Promise<Array<{labels: Array, text: string}>>}
   */
  async analyzeArticleImages(article) {
    const images = article.querySelectorAll('img[src]');
    const results = [];

    for (const img of images) {
      const src = img.src || '';
      // Filtrer : uniquement les images Instagram (pas les icônes/profil)
      if (!(src.includes('cdninstagram') || src.includes('scontent'))) continue;
      const width = img.naturalWidth || img.width || 0;
      if (width < 150) continue; // skip profile pics / icons

      const result = await this.analyzePostImage(img);
      if (!result.skipped) {
        results.push(result);
      }
    }

    return results;
  },

  /**
   * Capture a frame from a <video> element, OCR via ML Kit.
   * @param {HTMLVideoElement} videoElement
   * @param {string} postId - For dedup
   * @returns {Promise<{labels: Array, text: string, skipped: boolean}>}
   */
  async analyzeVideoFrame(videoElement, postId) {
    const dedupKey = 'video_' + postId;
    if (this._analyzedUrls.has(dedupKey)) {
      return { skipped: true, reason: 'already_analyzed' };
    }

    try {
      // Wait a bit for the video to show meaningful content
      if (videoElement.readyState < 2) {
        await new Promise(function(resolve) {
          videoElement.addEventListener('loadeddata', resolve, { once: true });
          setTimeout(resolve, 3000); // timeout
        });
      }

      var canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth || 720;
      canvas.height = videoElement.videoHeight || 1280;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      var base64 = canvas.toDataURL('image/jpeg', 0.7);

      this._analyzedUrls.add(dedupKey);

      if (window.Capacitor && window.Capacitor.Plugins.ImageAnalyzer) {
        return await window.Capacitor.Plugins.ImageAnalyzer.analyzeImage({
          image: base64,
          imageUrl: dedupKey,
        });
      }

      return { success: true, skipped: false, labels: [], text: '' };
    } catch (e) {
      console.error('[ImageAnalyzer] Video frame capture failed:', e);
      return { skipped: false, success: false, error: e.message };
    }
  },

  /**
   * Reset le cache de dédup (nouvelle session)
   */
  resetCache() {
    this._analyzedUrls.clear();
    if (window.Capacitor && window.Capacitor.Plugins.ImageAnalyzer) {
      window.Capacitor.Plugins.ImageAnalyzer.resetCache();
    }
  },

  /**
   * Stats du cache
   */
  getStats() {
    return { analyzedCount: this._analyzedUrls.size };
  }
};

window.ImageAnalyzer = ImageAnalyzer;
