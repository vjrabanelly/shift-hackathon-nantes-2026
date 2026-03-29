/**
 * ECHA Tracker — Injected into Instagram's mobile web WebView.
 * Monitors the DOM for posts, tracks dwell time, extracts content.
 * Sends data back to native via EchaBridge.
 */
(function() {
  'use strict';

  if (window.__ECHA_LOADED) return;
  window.__ECHA_LOADED = true;

  const SESSION_START = Date.now();
  const seenPosts = new Map(); // postId -> { firstSeen, lastSeen, data }
  let currentPostId = null;
  let currentPostStart = 0;
  let sessionId = null;
  let eventCount = 0;

  // ─── Initialize DB session ────────────────────────────────
  try {
    if (window.EchaBridge && window.EchaBridge.startSession) {
      sessionId = window.EchaBridge.startSession();
    }
  } catch(e) {}

  function log(msg) {
    console.log('[ECHA] ' + msg);
    sendToNative({ type: 'log', message: msg });
  }

  function sendToNative(data) {
    try {
      if (window.EchaBridge && window.EchaBridge.onData) {
        window.EchaBridge.onData(JSON.stringify(data));
      }
    } catch(e) {}
  }

  /**
   * Save post to mobile SQLite (DB-first).
   */
  function savePostToDB(postEntry) {
    try {
      if (window.EchaBridge && window.EchaBridge.savePost) {
        const payload = JSON.stringify({
          postId: postEntry.postId,
          username: postEntry.data.username,
          displayName: postEntry.data.displayName,
          caption: postEntry.data.caption,
          fullCaption: postEntry.data.fullCaption,
          hashtags: JSON.stringify(postEntry.data.hashtags || []),
          imageAlts: JSON.stringify(postEntry.data.imageAlts || []),
          imageUrls: JSON.stringify(postEntry.data.imageUrls || []),
          mediaType: postEntry.data.mediaType,
          likeCount: postEntry.data.likeCount,
          commentCount: postEntry.data.commentCount,
          isSponsored: postEntry.data.isSponsored,
          isSuggested: postEntry.data.isSuggested,
          dwellTimeMs: postEntry.dwellTimeMs,
          allText: postEntry.data.allText || '',
          date: postEntry.data.date,
          location: postEntry.data.location,
          audioTrack: postEntry.data.audioTrack,
          firstSeen: postEntry.firstSeen,
          lastSeen: postEntry.lastSeen,
          seenCount: postEntry.seenCount,
        });
        window.EchaBridge.savePost(payload);
      }
    } catch(e) {
      console.error('[ECHA] savePostToDB error:', e);
    }
  }

  /**
   * Update dwell time in mobile SQLite.
   */
  function updateDwellInDB(postId, username, dwellTimeMs) {
    try {
      if (window.EchaBridge && window.EchaBridge.updateDwell) {
        window.EchaBridge.updateDwell(postId, username, dwellTimeMs);
      }
    } catch(e) {}
  }

  /**
   * Save enrichment result to mobile SQLite.
   */
  function saveEnrichmentToDB(postId, enrichment) {
    try {
      if (window.EchaBridge && window.EchaBridge.saveEnrichment) {
        window.EchaBridge.saveEnrichment(postId, JSON.stringify(enrichment));
      }
    } catch(e) {}
  }

  /**
   * Enrich post locally via rules-engine and save to DB.
   */
  function enrichAndSave(postEntry) {
    try {
      if (typeof window.__echaEnrich !== 'function') return;
      const result = window.__echaEnrich({
        username: postEntry.data.username || '',
        caption: postEntry.data.caption || '',
        fullCaption: postEntry.data.fullCaption || '',
        imageAlts: postEntry.data.imageAlts || [],
        hashtags: postEntry.data.hashtags || [],
        allText: postEntry.data.allText || '',
      });
      if (result) {
        saveEnrichmentToDB(postEntry.postId, result);
      }
    } catch(e) {
      console.error('[ECHA] enrichAndSave error:', e);
    }
  }

  // End session on page unload
  window.addEventListener('beforeunload', function() {
    try {
      if (window.EchaBridge && window.EchaBridge.endSession) {
        window.EchaBridge.endSession(seenPosts.size, eventCount);
      }
    } catch(e) {}
  });
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      try {
        if (window.EchaBridge && window.EchaBridge.endSession) {
          window.EchaBridge.endSession(seenPosts.size, eventCount);
        }
      } catch(e) {}
    }
  });

  log('Tracker injected. Session: ' + (sessionId || 'unknown'));

  // ─── Post extraction from DOM ─────────────────────────────

  function extractPostFromArticle(article) {
    const post = {
      username: '',
      displayName: '',
      caption: '',
      fullCaption: '',
      hashtags: [],
      imageUrls: [],
      imageAlts: [],
      videoUrl: '',
      likeCount: '',
      commentCount: '',
      date: '',
      mediaType: 'photo',
      isSponsored: false,
      isSuggested: false,
      isReel: false,
      location: '',
      audioTrack: '',
      allText: '',
    };

    // Username — look for header link
    const headerLinks = article.querySelectorAll('header a');
    for (const link of headerLinks) {
      const href = link.getAttribute('href') || '';
      if (href.match(/^\/[^\/]+\/$/) && !href.includes('/p/') && !href.includes('/explore/')) {
        post.username = href.replace(/\//g, '');
        const nameSpan = link.querySelector('span');
        if (nameSpan) post.displayName = nameSpan.textContent || '';
        break;
      }
    }

    // Fallback username from any link with user pattern
    if (!post.username) {
      const allLinks = article.querySelectorAll('a[href]');
      for (const link of allLinks) {
        const href = link.getAttribute('href') || '';
        if (href.match(/^\/[a-zA-Z0-9_.]+\/$/) && link.textContent.trim()) {
          post.username = href.replace(/\//g, '');
          break;
        }
      }
    }

    // Sponsored
    const allText = article.textContent || '';
    if (allText.includes('Sponsorisé') || allText.includes('Sponsored') || allText.includes('Payé par')) {
      post.isSponsored = true;
    }
    if (allText.includes('Suggestion') || allText.includes('Suggested')) {
      post.isSuggested = true;
    }

    // Images — get all img elements with src
    const images = article.querySelectorAll('img[src]');
    for (const img of images) {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      // Filter out tiny icons and profile pics
      if (src.includes('cdninstagram') || src.includes('scontent')) {
        const width = img.naturalWidth || img.width || 0;
        if (width > 100 || alt.length > 20) {
          post.imageUrls.push(src);
          if (alt && alt.length > 5) {
            post.imageAlts.push(alt);
          }
        }
      }
    }

    // Videos
    const videos = article.querySelectorAll('video[src], video source[src]');
    for (const vid of videos) {
      const src = vid.getAttribute('src') || '';
      if (src) {
        post.videoUrl = src;
        post.mediaType = 'video';
      }
    }

    // Caption — Instagram web uses various selectors
    // Look for the main caption span
    const captionSelectors = [
      'div[role="button"] span', // "more" button parent
      'ul li span',              // comment list
      'h1',                       // single post caption
    ];

    // Caption extraction — multiple strategies
    const allSpans = article.querySelectorAll('span');
    for (const span of allSpans) {
      const text = (span.textContent || '').trim();
      // Strategy 1: span containing username followed by caption text
      if (text.includes(post.username) && text.length > post.username.length + 5 && !post.caption) {
        post.caption = text;
      }
    }

    // Strategy 2: look for the caption container (usually the first <li> or first visible text block after header)
    if (!post.caption) {
      const listItems = article.querySelectorAll('ul > div li, ul > li');
      if (listItems.length > 0) {
        post.caption = (listItems[0].textContent || '').trim();
      }
    }

    // Strategy 3: find "plus"/"more" button and grab the parent's full text
    const moreButtons = article.querySelectorAll('span[role="button"], button');
    for (const btn of moreButtons) {
      const btnText = (btn.textContent || '').trim().toLowerCase();
      if (btnText === 'plus' || btnText === 'more' || btnText === '... plus' || btnText === '... more') {
        // Try clicking to expand
        try { btn.click(); } catch {}
        // Get the expanded text from parent container
        const container = btn.closest('div') || btn.parentElement;
        if (container) {
          const expanded = (container.textContent || '').trim();
          if (expanded.length > post.fullCaption.length) {
            post.fullCaption = expanded;
          }
        }
      }
    }

    // If fullCaption is still empty or just "plus", use caption
    if (!post.fullCaption || post.fullCaption === 'plus' || post.fullCaption === 'more') {
      post.fullCaption = post.caption;
    }

    // Build allText for enrichment (combine all visible text content)
    const allTextParts = [post.username, post.caption, post.fullCaption];
    allTextParts.push(...post.imageAlts);
    allTextParts.push(...post.hashtags.map(h => '#' + h));
    if (post.location) allTextParts.push(post.location);
    post.allText = allTextParts.filter(Boolean).join(' ');

    // Hashtags
    const hashtagLinks = article.querySelectorAll('a[href*="/explore/tags/"]');
    for (const link of hashtagLinks) {
      post.hashtags.push(link.textContent || '');
    }

    // Like count
    const likeSection = article.querySelector('section');
    if (likeSection) {
      const likeText = likeSection.textContent || '';
      const likeMatch = likeText.match(/([\d\s,.]+)\s*(J'aime|like|mention)/i);
      if (likeMatch) post.likeCount = likeMatch[1].trim();
    }
    // Also try button/span patterns
    const buttons = article.querySelectorAll('button, span');
    for (const el of buttons) {
      const text = el.textContent || '';
      const match = text.match(/^([\d,.\s]+[KkMm]?)\s*(J'aime|like)/i);
      if (match) {
        post.likeCount = match[1].trim();
        break;
      }
    }

    // Date/time
    const timeEl = article.querySelector('time');
    if (timeEl) {
      post.date = timeEl.getAttribute('datetime') || timeEl.getAttribute('title') || timeEl.textContent || '';
    }

    // Location
    const locationLink = article.querySelector('a[href*="/explore/locations/"]');
    if (locationLink) {
      post.location = locationLink.textContent || '';
    }

    // Media type refinement
    if (post.imageUrls.length > 1) post.mediaType = 'carousel';
    if (article.querySelector('[aria-label*="Carousel"]') || article.querySelector('[aria-label*="carousel"]')) {
      post.mediaType = 'carousel';
    }

    return post;
  }

  // ─── Intersection Observer for dwell time ─────────────────

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const article = entry.target;
      const postId = article.dataset.echaId;

      if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
        // Post is more than 50% visible
        if (postId !== currentPostId) {
          // Finalize previous post
          if (currentPostId && seenPosts.has(currentPostId)) {
            const prev = seenPosts.get(currentPostId);
            prev.dwellTimeMs += Date.now() - currentPostStart;
            prev.lastSeen = Date.now();
            // DB-first: update dwell in mobile SQLite
            updateDwellInDB(prev.postId, prev.data.username, prev.dwellTimeMs);
            sendPostUpdate(prev);
          }

          currentPostId = postId;
          currentPostStart = Date.now();

          if (!seenPosts.has(postId)) {
            // New post detected
            const data = extractPostFromArticle(article);
            const postEntry = {
              postId,
              firstSeen: Date.now(),
              lastSeen: Date.now(),
              dwellTimeMs: 0,
              seenCount: 1,
              data,
            };
            seenPosts.set(postId, postEntry);
            log(`New post: @${data.username} (${data.mediaType})${data.isSponsored ? ' [AD]' : ''}`);
            eventCount++;
            // DB-first: persist to mobile SQLite
            savePostToDB(postEntry);
            // Enrich locally if enrichment engine is loaded
            enrichAndSave(postEntry);
            // Logcat fallback
            sendToNative({ type: 'new_post', post: postEntry });
          } else {
            seenPosts.get(postId).seenCount++;
          }
        }
      }
    }
  }, {
    threshold: [0.5],
  });

  function sendPostUpdate(entry) {
    // Strip imageUrls from updates to reduce payload (already sent with new_post)
    sendToNative({
      type: 'post_update',
      post: {
        postId: entry.postId,
        firstSeen: entry.firstSeen,
        lastSeen: entry.lastSeen,
        dwellTimeMs: entry.dwellTimeMs,
        seenCount: entry.seenCount,
        dwellTimeSec: Math.round(entry.dwellTimeMs / 100) / 10,
        data: {
          username: entry.data.username,
          displayName: entry.data.displayName,
          caption: entry.data.caption,
          fullCaption: (entry.data.fullCaption || '').substring(0, 200),
          hashtags: entry.data.hashtags,
          imageAlts: entry.data.imageAlts,
          videoUrl: entry.data.videoUrl || '',
          likeCount: entry.data.likeCount,
          commentCount: entry.data.commentCount,
          date: entry.data.date,
          mediaType: entry.data.mediaType,
          isSponsored: entry.data.isSponsored,
          isSuggested: entry.data.isSuggested,
          isReel: entry.data.isReel,
          location: entry.data.location,
          audioTrack: entry.data.audioTrack,
        },
      },
    });
  }

  // ─── Mutation Observer to detect new articles ─────────────

  let postCounter = 0;

  function scanForArticles() {
    const articles = document.querySelectorAll('article:not([data-echa-id])');
    for (const article of articles) {
      postCounter++;
      window.__echaPostCount = postCounter;
      const id = 'echa_' + postCounter;
      article.dataset.echaId = id;
      observer.observe(article);
    }
  }

  const mutationObserver = new MutationObserver(() => {
    scanForArticles();
  });

  // Start observing
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initial scan
  scanForArticles();

  // ─── Periodic session summary ─────────────────────────────

  setInterval(() => {
    // Finalize current post timing
    if (currentPostId && seenPosts.has(currentPostId)) {
      const current = seenPosts.get(currentPostId);
      current.dwellTimeMs += Date.now() - currentPostStart;
      currentPostStart = Date.now();
    }

    // Strip imageUrls from summary to avoid payload bloat (already sent with new_post events)
    const posts = Array.from(seenPosts.values()).map(entry => ({
      postId: entry.postId,
      firstSeen: entry.firstSeen,
      lastSeen: entry.lastSeen,
      dwellTimeMs: entry.dwellTimeMs,
      seenCount: entry.seenCount,
      dwellTimeSec: Math.round(entry.dwellTimeMs / 100) / 10,
      data: {
        username: entry.data.username,
        displayName: entry.data.displayName,
        caption: entry.data.caption,
        fullCaption: (entry.data.fullCaption || '').substring(0, 200),
        hashtags: entry.data.hashtags,
        imageAlts: entry.data.imageAlts,
        // imageUrls deliberately omitted — too large for logcat
        videoUrl: entry.data.videoUrl || '',
        likeCount: entry.data.likeCount,
        commentCount: entry.data.commentCount,
        date: entry.data.date,
        mediaType: entry.data.mediaType,
        isSponsored: entry.data.isSponsored,
        isSuggested: entry.data.isSuggested,
        isReel: entry.data.isReel,
        location: entry.data.location,
        audioTrack: entry.data.audioTrack,
      },
    }));

    sendToNative({
      type: 'session_summary',
      timestamp: Date.now(),
      sessionDurationSec: Math.round((Date.now() - SESSION_START) / 1000),
      totalPosts: posts.length,
      posts: posts.sort((a, b) => b.dwellTimeMs - a.dwellTimeMs),
    });
  }, 10000);

  // ─── Stories Tracker ───────────────────────────────────────

  let storyMode = false;
  let currentStoryUser = '';
  let currentStoryId = '';
  let storyStart = 0;
  let storySegmentStart = 0;
  let storyCounter = 0;
  const seenStories = new Map(); // storyId -> { username, firstSeen, dwellTimeMs, ... }

  function checkStoryMode() {
    const path = window.location.pathname;
    const storyMatch = path.match(/^\/stories\/([^\/]+)\/?(.*)$/);

    if (storyMatch) {
      const username = storyMatch[1];
      const storyPath = storyMatch[2] || '';

      if (!storyMode) {
        // Entering story mode
        storyMode = true;
        storyStart = Date.now();
        log(`Story mode: @${username}`);
      }

      // Detect story change (new user or new segment)
      const newStoryKey = `${username}/${storyPath}`;
      if (newStoryKey !== currentStoryId) {
        // Finalize previous story segment
        if (currentStoryId && seenStories.has(currentStoryId)) {
          const prev = seenStories.get(currentStoryId);
          prev.dwellTimeMs += Date.now() - storySegmentStart;
          prev.lastSeen = Date.now();
          updateDwellInDB(prev.postId, prev.data.username, prev.dwellTimeMs);
          prev.lastSeen = Date.now();
        }

        currentStoryUser = username;
        currentStoryId = newStoryKey;
        storySegmentStart = Date.now();

        if (!seenStories.has(currentStoryId)) {
          storyCounter++;
          const storyData = extractStoryContent(username);
          const entry = {
            postId: 'story_' + storyCounter,
            storyKey: currentStoryId,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            dwellTimeMs: 0,
            seenCount: 1,
            data: storyData,
          };
          seenStories.set(currentStoryId, entry);
          seenPosts.set(entry.postId, entry); // Add to main posts map too

          log(`New story: @${username} (${storyData.mediaType})`);
          eventCount++;
          savePostToDB(entry);
          enrichAndSave(entry);
          sendToNative({ type: 'new_post', post: entry });

          // Video story: capture frame for OCR after a short delay
          if (storyData.mediaType === 'story_video') {
            setTimeout(function() {
              try {
                var videoEl = document.querySelector('video');
                if (videoEl && window.ImageAnalyzer) {
                  window.ImageAnalyzer.analyzeVideoFrame(videoEl, entry.postId).then(function(result) {
                    if (result && result.text && result.text.trim()) {
                      log('Story video OCR: ' + result.text.substring(0, 80));
                      // Update post allText with OCR result
                      entry.data.ocrText = result.text;
                      entry.data.allText = (entry.data.allText || '') + ' [OCR] ' + result.text;
                      // Re-enrich with the new text
                      enrichAndSave(entry);
                    }
                  }).catch(function() {});
                }
              } catch(e) { log('Video OCR error: ' + e.message); }
            }, 1500); // Wait 1.5s for video to display content
          }
        } else {
          seenStories.get(currentStoryId).seenCount++;
        }
      }
    } else if (storyMode) {
      // Exiting story mode — finalize
      if (currentStoryId && seenStories.has(currentStoryId)) {
        const prev = seenStories.get(currentStoryId);
        prev.dwellTimeMs += Date.now() - storySegmentStart;
        prev.lastSeen = Date.now();
        updateDwellInDB(prev.postId, prev.data.username, prev.dwellTimeMs);
      }
      const totalStoryTime = Date.now() - storyStart;
      log(`Story mode ended. ${seenStories.size} stories seen, ${Math.round(totalStoryTime / 1000)}s total`);
      storyMode = false;
      currentStoryUser = '';
      currentStoryId = '';
    }
  }

  function extractStoryContent(username) {
    const story = {
      username: username,
      displayName: '',
      caption: '',
      fullCaption: '',
      hashtags: [],
      imageUrls: [],
      imageAlts: [],
      videoUrl: '',
      likeCount: '',
      commentCount: '',
      date: '',
      mediaType: 'story',
      isSponsored: false,
      isSuggested: false,
      isReel: false,
      location: '',
      audioTrack: '',
      allText: '',
    };

    // Stories use fullscreen img or video — find the largest visible media
    const allImages = document.querySelectorAll('img[src]');
    let bestImg = null;
    let bestSize = 0;
    for (const img of allImages) {
      const src = img.getAttribute('src') || '';
      if (!src.includes('cdninstagram') && !src.includes('scontent')) continue;
      const rect = img.getBoundingClientRect();
      const area = rect.width * rect.height;
      // Story images are typically large (>50% viewport)
      if (area > bestSize && rect.width > window.innerWidth * 0.3) {
        bestSize = area;
        bestImg = img;
      }
    }
    if (bestImg) {
      story.imageUrls.push(bestImg.getAttribute('src') || '');
      const alt = bestImg.getAttribute('alt') || '';
      if (alt.length > 5) story.imageAlts.push(alt);
    }

    // Video in story
    const videos = document.querySelectorAll('video[src], video source[src]');
    for (const vid of videos) {
      const src = vid.getAttribute('src') || '';
      if (src) {
        story.videoUrl = src;
        story.mediaType = 'story_video';
        break;
      }
    }

    // Text overlays and stickers — look for visible text not in tiny elements
    const textElements = document.querySelectorAll('span, div, h1, h2, p');
    const storyTexts = [];
    for (const el of textElements) {
      const rect = el.getBoundingClientRect();
      // Only visible elements in the story area
      if (rect.width < 50 || rect.height < 10) continue;
      if (rect.top < 0 || rect.bottom > window.innerHeight) continue;
      const text = (el.textContent || '').trim();
      // Filter out very short text (icons, buttons) and very long (page noise)
      if (text.length >= 3 && text.length <= 500 && !storyTexts.includes(text)) {
        // Skip navigation/UI elements
        var uiPatterns = [
          'Fermer', 'Close', 'Envoyer', 'Send', 'Répondre', 'Reply', 'Menu',
          'Direct', 'J\'aime', 'Like', 'Partager', 'Share', 'Suivre', 'Follow',
          'Réactions rapides', 'Le son est coupé', 'Chevron', 'Voir la traduction',
          'Regarder le reel', 'Reels', 'Plus', 'Moins',
        ];
        var isUI = uiPatterns.some(function(p) { return text === p || text.startsWith(p); });
        // Also skip emoji-only strings and reaction bars
        var emojiOnly = /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+$/u.test(text);
        if (isUI || emojiOnly) continue;
        storyTexts.push(text);
      }
    }

    // Extract username display name (usually visible at top of story)
    for (const text of storyTexts) {
      if (text.toLowerCase().includes(username.toLowerCase()) && text.length < 50) {
        story.displayName = text;
        break;
      }
    }

    // Sponsored story detection
    const pageText = document.body.textContent || '';
    if (pageText.includes('Sponsorisé') || pageText.includes('Sponsored') || pageText.includes('Payé par')) {
      story.isSponsored = true;
    }

    // Date/time
    const timeEl = document.querySelector('time');
    if (timeEl) {
      story.date = timeEl.getAttribute('datetime') || timeEl.textContent || '';
    }

    // Hashtags in story text
    for (const text of storyTexts) {
      const tags = text.match(/#[\w\u00C0-\u024F]+/g);
      if (tags) story.hashtags.push(...tags.map(t => t.replace('#', '')));
    }

    // Location sticker
    const locationLinks = document.querySelectorAll('a[href*="/explore/locations/"], a[href*="/locations/"]');
    for (const link of locationLinks) {
      story.location = link.textContent || '';
      break;
    }

    // Build caption from story texts (skip username display)
    story.caption = storyTexts.filter(t => !t.includes(username) || t.length > 50).join(' | ');
    story.fullCaption = story.caption;

    // Build allText
    const allTextParts = [username, ...storyTexts, ...story.imageAlts, ...story.hashtags.map(h => '#' + h)];
    if (story.location) allTextParts.push(story.location);
    story.allText = allTextParts.filter(Boolean).join(' ');

    return story;
  }

  // Poll for story mode changes (URL-based detection)
  setInterval(checkStoryMode, 500);

  // Also detect story entry via popstate/navigation events
  window.addEventListener('popstate', () => setTimeout(checkStoryMode, 100));

  // ─── Export function callable from native ─────────────────

  window.__echaExport = function() {
    // Finalize
    if (currentPostId && seenPosts.has(currentPostId)) {
      const current = seenPosts.get(currentPostId);
      current.dwellTimeMs += Date.now() - currentPostStart;
      currentPostStart = Date.now();
    }

    return {
      sessionStart: SESSION_START,
      sessionEnd: Date.now(),
      sessionDurationSec: Math.round((Date.now() - SESSION_START) / 1000),
      totalPosts: seenPosts.size,
      posts: Array.from(seenPosts.values()).map(entry => ({
        ...entry,
        dwellTimeSec: Math.round(entry.dwellTimeMs / 100) / 10,
      })).sort((a, b) => b.dwellTimeMs - a.dwellTimeMs),
    };
  };

  log('Tracker ready. ' + document.querySelectorAll('article').length + ' articles found.');
})();
