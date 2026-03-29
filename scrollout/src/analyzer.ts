/**
 * ECHA Analyzer — Analyse une session Instagram capturée.
 * Extrait les posts structurés depuis les noeuds bruts, calcule le dwell time,
 * catégorise le contenu, et produit un rapport lisible.
 *
 * Usage: npx tsx src/analyzer.ts [session_file.json]
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { ingestAnalysis, disconnect } from './db/ingest';

// ─── Types ───────────────────────────────────────────────────────────

interface RawNode {
  text: string;
  desc: string;
  class: string;
  resourceId: string;
  depth: number;
  clickable: boolean;
  scrollable: boolean;
  bounds: string;
}

interface RawEvent {
  timestamp: number;
  eventType: string;
  screenType: string;
  nodeCount: number;
  focusedPostId: string;
  nodes: RawNode[];
  imageDescriptions: string[];
  dwellTimes: Record<string, number>;
}

interface MLKitResult {
  postId: string;
  labels: Array<{ text: string; confidence: number }>;
  ocrText: string;
  processingMs: number;
}

interface SessionFile {
  capturedAt: string;
  durationSec: number;
  totalEvents: number;
  events: RawEvent[];
  mlkitResults?: Record<string, MLKitResult[]>;
}

interface ExtractedPost {
  username: string;
  displayName: string;
  caption: string;
  hashtags: string[];
  imageDescription: string;
  mediaType: 'photo' | 'video' | 'carousel' | 'reel' | 'story' | 'story_video';
  carouselCount: number;
  likeCount: string;
  likeNum: number;
  commentCount: string;
  commentNum: number;
  shareCount: string;
  saveCount: string;
  date: string;
  isSponsored: boolean;
  isSuggested: boolean;
  audioTrack: string;
  mentionedAccounts: string[];
  allTextContent: string; // all text + desc concatenated from the post's nodes
  ocrText: string; // texte détecté par MLKit (overlay/sous-titres brûlés)
  mlkitLabels: Array<{ text: string; confidence: number }>; // labels MLKit
  subtitles: string; // sous-titres Instagram auto-générés (reels plein écran)
  videoUrl: string; // URL CDN vidéo (depuis WebView tracker)
}

interface PostWithAttention extends ExtractedPost {
  firstSeenAt: number;
  lastSeenAt: number;
  dwellTimeMs: number;
  dwellTimeSec: number;
  seenCount: number;  // how many events this post appeared in
  contentCategory: string;
  attentionLevel: 'skipped' | 'glanced' | 'viewed' | 'engaged';
}

// ─── Resource ID shortcuts ───────────────────────────────────────────

function rid(node: RawNode): string {
  return (node.resourceId || '').replace('com.instagram.android:id/', '');
}

// ─── Post extraction from raw nodes ─────────────────────────────────

function extractPostsFromNodes(nodes: RawNode[]): ExtractedPost[] {
  const posts: ExtractedPost[] = [];

  // Find all username nodes (marks the start of a post)
  const usernameIndices: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (rid(nodes[i]) === 'row_feed_photo_profile_name') {
      usernameIndices.push(i);
    }
  }

  for (let idx = 0; idx < usernameIndices.length; idx++) {
    const startIdx = usernameIndices[idx];
    const endIdx = idx + 1 < usernameIndices.length
      ? usernameIndices[idx + 1]
      : nodes.length;

    const postNodes = nodes.slice(Math.max(0, startIdx - 3), endIdx);
    const post = parsePostNodes(postNodes);
    if (post.username) {
      // Try to extract subtitles from post's nodes
      const subs = extractSubtitles(postNodes);
      if (subs) post.subtitles = subs;
      posts.push(post);
    }
  }

  return posts;
}

function parsePostNodes(nodes: RawNode[]): ExtractedPost {
  const post: ExtractedPost = {
    username: '',
    displayName: '',
    caption: '',
    hashtags: [],
    imageDescription: '',
    mediaType: 'photo',
    carouselCount: 0,
    likeCount: '',
    likeNum: 0,
    commentCount: '',
    commentNum: 0,
    shareCount: '',
    saveCount: '',
    date: '',
    isSponsored: false,
    isSuggested: false,
    audioTrack: '',
    mentionedAccounts: [],
    allTextContent: '',
    ocrText: '',
    mlkitLabels: [],
    subtitles: '',
    videoUrl: '',
  };

  let afterLikeButton = false;
  let afterCommentButton = false;
  let afterShareButton = false;
  let likeFound = false;
  let commentFound = false;

  for (const node of nodes) {
    const r = rid(node);
    const text = node.text || '';
    const desc = node.desc || '';

    // Username
    if (r === 'row_feed_photo_profile_name') {
      post.username = text.trim();
    }

    // Follow button often contains display name
    if (r === 'inline_follow_button' && desc.startsWith('Suivre ')) {
      post.displayName = desc.replace('Suivre ', '');
    }

    // Header description (contains media type + date)
    if (r === 'row_feed_profile_header' && desc) {
      parseHeaderDesc(desc, post);
    }

    // Image/video description
    if (r === 'row_feed_photo_imageview' && desc) {
      post.imageDescription = desc;
      // Parse likes/comments from image desc
      const m = desc.match(/(\d[\d\s,.]*)\s*J'aime.*?(\d[\d\s,.]*)\s*commentaire/);
      if (m) {
        post.likeCount = m[1].trim();
        post.likeNum = parseCount(m[1]);
        post.commentCount = m[2].trim();
        post.commentNum = parseCount(m[2]);
      }
    }

    // Sponsored
    if (r === 'secondary_label' && (text === 'Sponsorisé' || text === 'Suggestions')) {
      if (text === 'Sponsorisé') post.isSponsored = true;
      if (text === 'Suggestions') post.isSuggested = true;
    }

    // Like button → next number is like count
    if (r === 'row_feed_button_like') {
      afterLikeButton = true;
      afterCommentButton = false;
      afterShareButton = false;
      continue;
    }
    if (r === 'row_feed_button_comment') {
      afterCommentButton = true;
      afterLikeButton = false;
      afterShareButton = false;
      continue;
    }
    if (r === 'row_feed_button_share') {
      afterShareButton = true;
      afterLikeButton = false;
      afterCommentButton = false;
      continue;
    }

    // Number after engagement buttons
    if (text && text.match(/^[\d\s,.K]+$/) && !r) {
      if (afterLikeButton && !likeFound) {
        post.likeCount = text.trim();
        post.likeNum = parseCount(text);
        likeFound = true;
        afterLikeButton = false;
      } else if (afterCommentButton && !commentFound) {
        post.commentCount = text.trim();
        post.commentNum = parseCount(text);
        commentFound = true;
        afterCommentButton = false;
      } else if (afterShareButton) {
        post.shareCount = text.trim();
        afterShareButton = false;
      }
    }

    // Caption (contains username + text)
    if (!r && text.startsWith(post.username) && text.length > post.username.length + 3
        && !post.caption) {
      post.caption = text.substring(post.username.length).trim();
      // Clean trailing "… plus"
      post.caption = post.caption.replace(/…\s*plus$/, '…');
    }

    // Hashtags
    if (!r && desc.startsWith('#')) {
      post.hashtags.push(desc);
    }

    // Date
    if (!r && text && isDateText(text) && !post.date) {
      post.date = text.trim();
    }
    if (!r && desc && isDateText(desc) && !post.date) {
      post.date = desc.trim();
    }

    // Audio track
    if (desc && desc.includes('·') && desc.includes(post.username)) {
      const parts = desc.split('·');
      if (parts.length >= 2) {
        post.audioTrack = parts[parts.length - 1].trim();
      }
    }

    // Mentioned accounts (from desc buttons starting with @)
    if (desc.startsWith('@') && desc.length > 2) {
      post.mentionedAccounts.push(desc);
    }

    // Collect ALL text content for categorization and full caption reconstruction
    if (text && text.length > 2) post.allTextContent += ' ' + text;
    if (desc && desc.length > 2) post.allTextContent += ' ' + desc;
  }

  // Reconstruct fuller caption from allTextContent if current caption is truncated
  if (post.caption.endsWith('…') || !post.caption) {
    // Look for the IgTextLayoutView content which has the full visible caption
    for (const node of nodes) {
      const cls = node.class || '';
      const text = node.text || '';
      if (cls.includes('IgTextLayoutView') && text.includes(post.username) && text.length > (post.caption.length + post.username.length)) {
        post.caption = text.substring(text.indexOf(post.username) + post.username.length).trim();
        post.caption = post.caption.replace(/…\s*plus$/, '…');
        break;
      }
    }
  }

  // Extract hashtags from caption if not found as separate nodes
  if (post.hashtags.length === 0 && post.caption) {
    const tagMatches = post.caption.match(/#\w+/g);
    if (tagMatches) post.hashtags = tagMatches;
  }

  return post;
}

/**
 * Extracts stories from accessibility nodes when screenType is "story".
 * Stories appear as "Story de username, X sur Y, Vus." in content descriptions.
 */
function extractStoriesFromNodes(nodes: RawNode[]): ExtractedPost[] {
  const stories: ExtractedPost[] = [];
  const storyPattern = /Story de (.+?),\s*(\d+)\s*sur\s*(\d+)/i;

  for (const node of nodes) {
    const desc = node.desc || '';
    const match = desc.match(storyPattern);
    if (match) {
      const username = match[1].trim();
      const frameIndex = parseInt(match[2], 10);
      const totalFrames = parseInt(match[3], 10);

      // Avoid duplicates — use username + frame as key
      const key = `${username}_frame${frameIndex}`;
      if (stories.some(s => s.username === key)) continue;

      const post: ExtractedPost = {
        username,
        displayName: '',
        caption: '',
        hashtags: [],
        imageDescription: desc,
        mediaType: 'story',
        carouselCount: totalFrames,
        likeCount: '',
        likeNum: 0,
        commentCount: '',
        commentNum: 0,
        shareCount: '',
        saveCount: '',
        date: '',
        isSponsored: false,
        isSuggested: false,
        audioTrack: '',
        mentionedAccounts: [],
        allTextContent: '',
        ocrText: '',
        mlkitLabels: [],
        subtitles: '',
      };

      // Scan surrounding nodes for story content
      const nodeIdx = nodes.indexOf(node);
      const contextNodes = nodes.slice(Math.max(0, nodeIdx - 5), Math.min(nodes.length, nodeIdx + 20));

      for (const ctxNode of contextNodes) {
        const text = ctxNode.text || '';
        const ctxDesc = ctxNode.desc || '';

        // Sponsored detection
        if (text === 'Sponsorisé' || text === 'Sponsored' || ctxDesc.includes('Payé par')) {
          post.isSponsored = true;
        }

        // Video detection in story
        if (ctxDesc.includes('video') || ctxDesc.includes('Vidéo')) {
          post.mediaType = 'story_video';
        }

        // Text overlays (non-empty text nodes without resourceId)
        const r = rid(ctxNode);
        if (!r && text.length > 3 && !text.match(/^\d+$/) && !storyPattern.test(text)) {
          post.allTextContent += ' ' + text;
        }
        if (!r && ctxDesc.length > 3 && !storyPattern.test(ctxDesc)) {
          post.allTextContent += ' ' + ctxDesc;
        }

        // Hashtags
        if (ctxDesc.startsWith('#')) post.hashtags.push(ctxDesc);
        const hashtagsInText = text.match(/#[\w\u00C0-\u024F]+/g);
        if (hashtagsInText) post.hashtags.push(...hashtagsInText);

        // Mentions
        if (ctxDesc.startsWith('@') && ctxDesc.length > 2) {
          post.mentionedAccounts.push(ctxDesc);
        }
      }

      // Build caption from allTextContent
      post.caption = post.allTextContent.trim().substring(0, 500);

      stories.push(post);
    }
  }

  return stories;
}

/**
 * Extracts Instagram auto-generated subtitles from accessibility nodes.
 * In reel full-screen viewer, subtitles appear as TextView nodes without resourceId
 * with class containing 'SubtitleTextView' or 'ClosedCaption'.
 * In feed view, they may appear in imageDescription containing transcript-like text.
 */
function extractSubtitles(nodes: RawNode[]): string {
  const subtitleTexts: string[] = [];

  for (const node of nodes) {
    const cls = node.class || '';
    const r = rid(node);
    const text = node.text || '';

    // Pattern 1: Instagram subtitle view (reels plein écran)
    if (!r && (cls.includes('Subtitle') || cls.includes('ClosedCaption') || cls.includes('Caption'))) {
      if (text.length > 5) subtitleTexts.push(text.trim());
    }

    // Pattern 2: accessibility subtitle nodes (no resourceId, specific class patterns)
    if (!r && cls.includes('TextView') && text.length > 20) {
      // Heuristic: subtitle text is typically sentence-like, not a username or button
      const looksLikeSentence = /[a-zàâéèêëîïôùûüç]{3,}/i.test(text) &&
        !text.match(/^[\d\s,.K]+$/) && // not a number
        !text.match(/^@/) && // not a mention
        !text.match(/^#/) && // not a hashtag
        !text.startsWith('Suivi') && // not a follow indicator
        !text.startsWith('Sponsorisé') &&
        !text.match(/il y a|hier|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche/i); // not a date
      // Only consider as subtitle if it looks transcription-like (spoken language)
      if (looksLikeSentence && text.split(' ').length >= 4) {
        // This is a candidate but needs more context — only pick if not already captured as caption
        // We'll deduplicate later in the pipeline
      }
    }
  }

  return subtitleTexts.join(' ');
}

function parseHeaderDesc(desc: string, post: ExtractedPost): void {
  if (desc.includes('video') || desc.includes('reel')) {
    post.mediaType = 'video';
  } else if (desc.includes('carousel')) {
    post.mediaType = 'carousel';
  } else if (desc.includes('photo')) {
    post.mediaType = 'photo';
  }

  // Extract date from header
  const dateMatch = desc.match(/le\s+(.+)$/);
  if (dateMatch && !post.date) {
    post.date = dateMatch[1].trim();
  }
}

function isDateText(text: string): boolean {
  const t = text.toLowerCase();
  return /il y a/.test(t) || /hier/.test(t) ||
    /\d+\s*(mars|février|janvier|avril|mai|juin|juil|août|sept|oct|nov|déc)/.test(t) ||
    /\d+\s*(hour|day|week|month|ago|min)/.test(t);
}

function parseCount(text: string): number {
  const clean = text.replace(/\s/g, '').replace(',', '.');
  if (clean.includes('K')) return parseFloat(clean.replace('K', '')) * 1000;
  if (clean.includes('M')) return parseFloat(clean.replace('M', '')) * 1000000;
  return parseInt(clean, 10) || 0;
}

// ─── Content categorization ─────────────────────────────────────────

const CATEGORIES: Array<{ name: string; patterns: RegExp[] }> = [
  {
    name: 'actualités/info',
    patterns: [
      /lemondefr|franceinter|franceculture|francetv|bfm|cnews|france24|mediapart|liberation|lefigaro|20minutes|huffpost|nouvelobs|reuters|apnews|nytimes/i,
      /actualité|info|breaking|politique|élection|gouvernement|ministre|président|parlement|loi|réforme|crise|économie/i,
    ],
  },
  {
    name: 'jeux/gaming',
    patterns: [
      /boardgame|dice|dnd|baldur|rpg|tabletop|playstation|xbox|nintendo|meeple|warhammer|pokemon|zelda|smash|elden.?ring|steam/i,
      /\bgame\b|\bgaming\b|\bjeu\b|\bjouer\b|\bludique\b|\bludo\b|\bcards?\b|\bdeck\b|\bjoueur/i,
      /gamegeek|boardgame|brokentoken|kickstarter.*game|gamefound|crowdfunding.*game|acubed|nerdx|jvcom|jeuxvideo/i,
    ],
  },
  {
    name: 'manga/anime/illustration',
    patterns: [
      /manga|anime|otaku|webtoon|comic|bd\b|bande.?dessinée|illustration|dessin|draw|sketch|character.?design|onimon/i,
      /naruto|one.?piece|dragon.?ball|jujutsu|demon.?slayer|shonen|seinen|studio.?ghibli|cosplay/i,
      /pataques|delcourt|dargaud|dupuis|glénat|kana|ki-oon/i,
      /rehausse.*manga|support.*manga|étagère.*manga|collection.*manga|mangashelf/i,
    ],
  },
  {
    name: 'art/culture',
    patterns: [
      /museum|musée|\bart\b|galerie|exposition|peinture|sculpture|œuvre|artiste|vernissage|biennale|contemporain/i,
      /cinema|film|série|théâtre|spectacle|danse|opéra|ballet|festival|photographie/i,
      /livre|librairie|littérature|roman|auteur|éditeur|bibliothèque|lecture/i,
      /corpsexquis|immersion|installation/i,
    ],
  },
  {
    name: 'créateurs/DIY',
    patterns: [
      /diy|handmade|craft|maker|fabri|brico|custom|atelier|création|woodwork|3d.?print|impression.?3d|laser.?cut/i,
      /tuto|tutorial|howto|comment.?faire|support|rangement|organis|rehausse|étagère|meuble/i,
      /studio|studiolife|behind.?the.?scene|process|workflow/i,
    ],
  },
  {
    name: 'mode/luxe',
    patterns: [
      /fashion|mode|style|outfit|ootd|look|trend|collection|défilé|runway|couture/i,
      /luxe|luxury|watch|montre|bijou|jewelry|cartier|tagheuer|rolex|dior|chanel|vuitton|hermès|gucci|prada/i,
      /sneakers|shoes|nike|adidas|streetwear|vintage/i,
      /panthère|précieux|mécanique.*code|innovation.*shaped/i,
    ],
  },
  {
    name: 'voyage/géo',
    patterns: [
      /travel|voyage|destination|wander|backpack|roadtrip|itinéraire|escale/i,
      /nature|paysage|landscape|outdoor|montagne|plage|mer|ocean|forêt|lac|island|trek|randonn/i,
      /geo_net|francetraveler|atlas|carte|map|géograph|francaisdenosregions/i,
    ],
  },
  {
    name: 'food/boisson',
    patterns: [
      /food|cuisine|restaurant|recette|cook|chef|gastronom|brunch|dinner|lunch|breakfast/i,
      /bière|beer|wine|vin|café|coffee|cocktail|bar\b|bistro|boulangerie|bakery|patisserie/i,
      /deliveroo|ubereats|justeat|pizza|burger|sushi|vegan|bio\b|organic/i,
    ],
  },
  {
    name: 'tech/science',
    patterns: [
      /tech|code|coding|dev\b|develop|programming|software|hardware|app\b|startup|digital|crypto|blockchain/i,
      /science|space|nasa|physique|chimie|math|biology|research|innovation|lab\b|experiment/i,
      /ai\b|artificial|machine.?learning|robot|drone|vr\b|ar\b|metavers/i,
      /episto|epsilon|vulgarisation|savoir|connaissance|apprendre|éducation/i,
    ],
  },
  {
    name: 'humour/divertissement',
    patterns: [
      /meme|funny|humour|humor|comic|lol|blague|sketch|parodie|satire|troll|wtf|fail/i,
      /satisfying|oddly|asmr|compilation|reaction|challenge|trend/i,
    ],
  },
  {
    name: 'sport/fitness',
    patterns: [
      /sport|fitness|foot|basket|tennis|running|gym|musculation|yoga|crossfit|match|champion|league/i,
      /workout|training|exercise|cardio|marathon|cyclisme|natation|boxe|mma|surf|ski|escalade/i,
    ],
  },
  {
    name: 'musique',
    patterns: [
      /music|musique|concert|album|song|spotify|artist|guitar|piano|dj\b|rap\b|rock\b|jazz|electro/i,
      /vinyl|platine|synth|beat|producer|clip|feat\b|single|ep\b|release/i,
    ],
  },
  {
    name: 'immobilier/commerce',
    patterns: [
      /immobilier|achat|vente|maison|appartement|offre|promo|solde|discount|prix|livraison/i,
      /librairie|boutique|shop|store|commander|acheter|deal|réduction/i,
    ],
  },
  {
    name: 'vie sociale/perso',
    patterns: [
      /ami|friend|famille|family|wedding|mariage|anniversaire|birthday|soirée|fête|vacances|weekend/i,
      /bde\b|asso|école|campus|étudiant|student|promo\b|alumni|isima/i,
    ],
  },
  {
    name: 'nature/animaux',
    patterns: [
      /animal|chat|cat\b|dog|chien|bird|oiseau|wildlife|faune|flore|plante|jardin|garden|aquarium|zoo/i,
      /pet|kitten|puppy|coral|reef|forest|jungle|savane/i,
    ],
  },
  {
    name: 'design/architecture',
    patterns: [
      /design|architect|interior|décor|déco|furniture|mobilier|minimal|aesthetic|brutalis/i,
      /building|structure|urban|skyline|façade|renovation|aménagement/i,
      /escape.?the.?city|escape.?game|aventure.*rue|jeu.*ville/i,
    ],
  },
];

// Words to strip from allTextContent (navigation/profile noise)
const NOISE_WORDS = /\b(home|reels|profil|rechercher|explorer|envoyer|message|ajouter|modifier|partager|contacts|découvrir|voir tout|suivre|suivi|followers|publications|j'aime|commentaire|enregistrement|fermer|options|créer|threads|sponsorisé|suggestions)\b/gi;

function categorizePost(post: ExtractedPost): string {
  // Primary blob: username + caption + hashtags + displayName (most reliable)
  const primaryBlob = [
    post.username, post.caption, post.hashtags.join(' '),
    post.displayName, post.audioTrack,
  ].join(' ');

  // Secondary blob: image description + cleaned allTextContent (noisier)
  const cleanedText = (post.allTextContent || '').replace(NOISE_WORDS, '');
  const secondaryBlob = [post.imageDescription, cleanedText].join(' ');

  // First pass: match on primary (high confidence)
  for (const cat of CATEGORIES) {
    for (const pattern of cat.patterns) {
      if (pattern.test(primaryBlob)) return cat.name;
    }
  }

  // Second pass: match on secondary (lower confidence)
  for (const cat of CATEGORIES) {
    for (const pattern of cat.patterns) {
      if (pattern.test(secondaryBlob)) return cat.name;
    }
  }

  if (post.isSponsored) return 'publicité';
  return 'non classifié';
}

// ─── Attention level ────────────────────────────────────────────────

function classifyAttention(dwellSec: number): PostWithAttention['attentionLevel'] {
  if (dwellSec < 0.5) return 'skipped';
  if (dwellSec < 2) return 'glanced';
  if (dwellSec < 5) return 'viewed';
  return 'engaged';
}

// ─── Main analysis ──────────────────────────────────────────────────

async function analyzeSession(sessionPath: string): Promise<void> {
  const raw: SessionFile = JSON.parse(readFileSync(sessionPath, 'utf-8'));
  const events = raw.events;

  console.log('Analysing', events.length, 'events...\n');

  // Extract all unique posts across all events
  const postMap = new Map<string, PostWithAttention>();
  const postTimeline: Array<{ timestamp: number; username: string }> = [];

  for (const evt of events) {
    if (!evt.nodes) continue;

    // Use story-specific extraction for story screens
    const posts = evt.screenType === 'story'
      ? extractStoriesFromNodes(evt.nodes)
      : extractPostsFromNodes(evt.nodes);

    for (const post of posts) {
      const key = post.username;
      if (!key) continue;

      if (!postMap.has(key)) {
        postMap.set(key, {
          ...post,
          firstSeenAt: evt.timestamp,
          lastSeenAt: evt.timestamp,
          dwellTimeMs: 0,
          dwellTimeSec: 0,
          seenCount: 0,
          contentCategory: categorizePost(post),
          attentionLevel: 'skipped',
        });
      }

      const tracked = postMap.get(key)!;
      tracked.lastSeenAt = evt.timestamp;
      tracked.seenCount++;

      // Update with richer data if available
      if (post.caption && post.caption.length > tracked.caption.length) tracked.caption = post.caption;
      if (post.imageDescription && post.imageDescription.length > tracked.imageDescription.length)
        tracked.imageDescription = post.imageDescription;
      if (post.likeNum > tracked.likeNum) {
        tracked.likeCount = post.likeCount;
        tracked.likeNum = post.likeNum;
      }
      if (post.commentNum > tracked.commentNum) {
        tracked.commentCount = post.commentCount;
        tracked.commentNum = post.commentNum;
      }
      if (!tracked.date && post.date) tracked.date = post.date;
      if (post.shareCount) tracked.shareCount = post.shareCount;
      if (post.hashtags.length > tracked.hashtags.length) tracked.hashtags = post.hashtags;
      if (post.audioTrack) tracked.audioTrack = post.audioTrack;
    }

    // Track focused post for timeline
    if (evt.focusedPostId) {
      const username = evt.focusedPostId.split('|')[0];
      postTimeline.push({ timestamp: evt.timestamp, username });
    }
  }

  // Calculate dwell time from timeline (time between post transitions)
  for (let i = 0; i < postTimeline.length; i++) {
    const current = postTimeline[i];
    const next = postTimeline[i + 1];
    const duration = next ? next.timestamp - current.timestamp : 1000;

    const post = postMap.get(current.username);
    if (post) {
      post.dwellTimeMs += duration;
    }
  }

  // Merge MLKit OCR results into posts
  if (raw.mlkitResults) {
    for (const [mlPostId, results] of Object.entries(raw.mlkitResults)) {
      // mlPostId format: "username|hash" — match by username prefix
      const username = mlPostId.split('|')[0];
      const post = postMap.get(username);
      if (post) {
        // Aggregate OCR text from all results (deduplicated)
        const ocrTexts = new Set<string>();
        for (const r of results) {
          if (r.ocrText) ocrTexts.add(r.ocrText.trim());
          if (r.labels?.length) {
            for (const label of r.labels) {
              const existing = post.mlkitLabels.find(l => l.text === label.text);
              if (!existing || label.confidence > existing.confidence) {
                if (existing) existing.confidence = label.confidence;
                else post.mlkitLabels.push({ ...label });
              }
            }
          }
        }
        post.ocrText = [...ocrTexts].join(' ');
      }
    }
  }

  // Finalize posts
  const allPosts = [...postMap.values()]
    .map(p => {
      p.dwellTimeSec = Math.round(p.dwellTimeMs / 100) / 10;
      p.attentionLevel = classifyAttention(p.dwellTimeSec);
      return p;
    })
    .sort((a, b) => b.dwellTimeMs - a.dwellTimeMs);

  // ─── Generate Report ────────────────────────────────────────────

  const totalTime = allPosts.reduce((s, p) => s + p.dwellTimeMs, 0);
  const report: string[] = [];

  report.push('╔══════════════════════════════════════════════════════════════════╗');
  report.push('║           ECHA — Rapport d\'analyse Instagram                    ║');
  report.push('╚══════════════════════════════════════════════════════════════════╝');
  report.push('');
  report.push(`Session:   ${raw.capturedAt}`);
  report.push(`Durée:     ${raw.durationSec}s`);
  report.push(`Events:    ${events.length}`);
  report.push(`Posts vus: ${allPosts.length}`);
  report.push(`Temps total de visionnage: ${(totalTime / 1000).toFixed(1)}s`);
  report.push('');

  // ─── Attention distribution ─────────────────────────────
  const attentionDist = {
    skipped: allPosts.filter(p => p.attentionLevel === 'skipped'),
    glanced: allPosts.filter(p => p.attentionLevel === 'glanced'),
    viewed: allPosts.filter(p => p.attentionLevel === 'viewed'),
    engaged: allPosts.filter(p => p.attentionLevel === 'engaged'),
  };

  report.push('┌─────────────────────────────────────────────────────────────────┐');
  report.push('│ DISTRIBUTION DE L\'ATTENTION                                     │');
  report.push('├─────────────────────────────────────────────────────────────────┤');
  report.push(`│ ⏭  Skipped  (<0.5s)  : ${String(attentionDist.skipped.length).padStart(3)} posts`);
  report.push(`│ 👁  Glanced  (0.5-2s) : ${String(attentionDist.glanced.length).padStart(3)} posts`);
  report.push(`│ 👀 Viewed   (2-5s)   : ${String(attentionDist.viewed.length).padStart(3)} posts`);
  report.push(`│ 🔍 Engaged  (>5s)    : ${String(attentionDist.engaged.length).padStart(3)} posts`);
  report.push('└─────────────────────────────────────────────────────────────────┘');
  report.push('');

  // ─── Category breakdown ─────────────────────────────────
  const categoryStats = new Map<string, { count: number; totalMs: number; posts: PostWithAttention[] }>();
  for (const post of allPosts) {
    const cat = post.contentCategory;
    if (!categoryStats.has(cat)) categoryStats.set(cat, { count: 0, totalMs: 0, posts: [] });
    const stat = categoryStats.get(cat)!;
    stat.count++;
    stat.totalMs += post.dwellTimeMs;
    stat.posts.push(post);
  }

  const sortedCats = [...categoryStats.entries()].sort((a, b) => b[1].totalMs - a[1].totalMs);

  report.push('┌─────────────────────────────────────────────────────────────────┐');
  report.push('│ CATÉGORIES DE CONTENU (par temps passé)                         │');
  report.push('├─────────────────────────────────────────────────────────────────┤');
  for (const [cat, stat] of sortedCats) {
    const pct = totalTime > 0 ? Math.round((stat.totalMs / totalTime) * 100) : 0;
    const bar = '█'.repeat(Math.round(pct / 2));
    report.push(`│ ${cat.padEnd(25)} ${String(stat.count).padStart(2)} posts  ${String((stat.totalMs / 1000).toFixed(1)).padStart(6)}s  ${String(pct).padStart(3)}% ${bar}`);
  }
  report.push('└─────────────────────────────────────────────────────────────────┘');
  report.push('');

  // ─── Sponsored vs organic ──────────────────────────────
  const sponsored = allPosts.filter(p => p.isSponsored);
  const suggested = allPosts.filter(p => p.isSuggested && !p.isSponsored);
  const organic = allPosts.filter(p => !p.isSponsored && !p.isSuggested);

  const sponsoredTime = sponsored.reduce((s, p) => s + p.dwellTimeMs, 0);
  const suggestedTime = suggested.reduce((s, p) => s + p.dwellTimeMs, 0);
  const organicTime = organic.reduce((s, p) => s + p.dwellTimeMs, 0);

  report.push('┌─────────────────────────────────────────────────────────────────┐');
  report.push('│ ORIGINE DU CONTENU                                              │');
  report.push('├─────────────────────────────────────────────────────────────────┤');
  report.push(`│ 🟢 Abonnements (organique) : ${organic.length} posts — ${(organicTime / 1000).toFixed(1)}s (${pct(organicTime, totalTime)}%)`);
  report.push(`│ 🟡 Suggestions algorithme   : ${suggested.length} posts — ${(suggestedTime / 1000).toFixed(1)}s (${pct(suggestedTime, totalTime)}%)`);
  report.push(`│ 🔴 Publicités (sponsorisé)  : ${sponsored.length} posts — ${(sponsoredTime / 1000).toFixed(1)}s (${pct(sponsoredTime, totalTime)}%)`);
  report.push('└─────────────────────────────────────────────────────────────────┘');
  report.push('');

  // ─── Detailed post list ────────────────────────────────
  report.push('┌─────────────────────────────────────────────────────────────────┐');
  report.push('│ DÉTAIL DES POSTS (par temps d\'attention)                         │');
  report.push('└─────────────────────────────────────────────────────────────────┘');
  report.push('');

  for (const post of allPosts) {
    const icon = post.attentionLevel === 'engaged' ? '🔍' :
                 post.attentionLevel === 'viewed' ? '👀' :
                 post.attentionLevel === 'glanced' ? '👁 ' : '⏭ ';
    const sponsorTag = post.isSponsored ? ' 🔴AD' : '';
    const suggestTag = post.isSuggested ? ' 🟡ALGO' : '';
    const mediaIcon = post.mediaType === 'video' ? '🎬' :
                      post.mediaType === 'carousel' ? '🖼️' :
                      post.mediaType === 'reel' ? '🎞️' : '📷';

    report.push(`${icon} @${post.username} — ${post.dwellTimeSec}s ${mediaIcon}${sponsorTag}${suggestTag}`);
    report.push(`   Catégorie: ${post.contentCategory}`);

    if (post.imageDescription) {
      report.push(`   Image: ${post.imageDescription.substring(0, 90)}`);
    }
    if (post.caption) {
      report.push(`   Caption: ${post.caption.substring(0, 90)}`);
    }
    if (post.hashtags.length > 0) {
      report.push(`   Tags: ${post.hashtags.join(' ')}`);
    }
    if (post.likeCount || post.commentCount) {
      const parts = [];
      if (post.likeCount) parts.push(`${post.likeCount} likes`);
      if (post.commentCount) parts.push(`${post.commentCount} commentaires`);
      if (post.shareCount) parts.push(`${post.shareCount} partages`);
      report.push(`   Engagement: ${parts.join(' · ')}`);
    }
    if (post.date) {
      report.push(`   Date: ${post.date}`);
    }
    if (post.audioTrack) {
      report.push(`   Audio: ${post.audioTrack}`);
    }
    if (post.ocrText) {
      report.push(`   OCR: ${post.ocrText.substring(0, 90)}`);
    }
    report.push('');
  }

  // Print report
  const reportText = report.join('\n');
  console.log(reportText);

  // Save report
  const reportPath = sessionPath.replace('.json', '_report.txt');
  writeFileSync(reportPath, reportText, 'utf-8');

  // Save structured analysis
  const analysisPath = sessionPath.replace('.json', '_analysis.json');
  writeFileSync(analysisPath, JSON.stringify({
    session: {
      capturedAt: raw.capturedAt,
      durationSec: raw.durationSec,
      totalEvents: events.length,
      totalViewTimeSec: totalTime / 1000,
    },
    attention: {
      skipped: attentionDist.skipped.length,
      glanced: attentionDist.glanced.length,
      viewed: attentionDist.viewed.length,
      engaged: attentionDist.engaged.length,
    },
    categories: Object.fromEntries(sortedCats.map(([cat, stat]) => [cat, {
      count: stat.count,
      totalTimeSec: stat.totalMs / 1000,
      pct: pct(stat.totalMs, totalTime),
    }])),
    origin: {
      organic: { count: organic.length, timeSec: organicTime / 1000, pct: pct(organicTime, totalTime) },
      suggested: { count: suggested.length, timeSec: suggestedTime / 1000, pct: pct(suggestedTime, totalTime) },
      sponsored: { count: sponsored.length, timeSec: sponsoredTime / 1000, pct: pct(sponsoredTime, totalTime) },
    },
    posts: allPosts,
  }, null, 2), 'utf-8');

  console.log(`\nRapport: ${reportPath}`);
  console.log(`Analyse: ${analysisPath}`);

  // Auto-ingest dans SQLite
  try {
    const result = await ingestAnalysis(analysisPath);
    console.log(`SQLite: ${result.postCount} posts ingérés (session ${result.sessionId})`);
  } catch (err) {
    console.error('[analyzer] Ingest SQLite failed:', err);
  } finally {
    await disconnect();
  }
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// ─── Run ─────────────────────────────────────────────────────────────

const sessionFile = process.argv[2] || (() => {
  // Find latest session file
  const fs = require('fs');
  const files = fs.readdirSync(path.join(__dirname, '..', 'data'))
    .filter((f: string) => f.startsWith('session_') && f.endsWith('.json') && !f.includes('_analysis') && !f.includes('_report'))
    .sort()
    .reverse();
  if (files.length === 0) {
    console.error('No session files found. Run capture.ts first.');
    process.exit(1);
  }
  return path.join(__dirname, '..', 'data', files[0]);
})();

analyzeSession(sessionFile).catch(err => {
  console.error('[analyzer] Fatal:', err);
  process.exit(1);
});
