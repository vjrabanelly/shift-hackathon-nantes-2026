/**
 * Parse UIAutomator XML dump and extract Instagram-relevant data
 */

interface UINode {
  class: string;
  text: string;
  contentDesc: string;
  resourceId: string;
  bounds: string;
  clickable: boolean;
  children: UINode[];
}

export interface InstagramData {
  timestamp: string;
  screen: string;
  posts: PostData[];
  profileInfo: ProfileInfo | null;
  rawNodes: UINode[];
}

export interface PostData {
  username: string;
  caption: string;
  likes: string;
  comments: string;
  timestamp: string;
  contentDescriptions: string[];
}

export interface ProfileInfo {
  username: string;
  fullName: string;
  bio: string;
  followers: string;
  following: string;
  posts: string;
}

function parseNode(nodeStr: string): UINode {
  const attr = (name: string): string => {
    const match = nodeStr.match(new RegExp(`${name}="([^"]*)"`));
    return match ? match[1] : '';
  };

  return {
    class: attr('class'),
    text: attr('text'),
    contentDesc: attr('content-desc'),
    resourceId: attr('resource-id'),
    bounds: attr('bounds'),
    clickable: attr('clickable') === 'true',
    children: [],
  };
}

export function parseXmlDump(xml: string): UINode[] {
  const nodes: UINode[] = [];
  // Simple regex-based parser for UIAutomator XML (flat extraction)
  const nodeRegex = /<node\s[^>]+>/g;
  let match: RegExpExecArray | null;

  while ((match = nodeRegex.exec(xml)) !== null) {
    const node = parseNode(match[0]);
    if (node.text || node.contentDesc) {
      nodes.push(node);
    }
  }

  return nodes;
}

export function extractInstagramData(xml: string): InstagramData {
  const nodes = parseXmlDump(xml);
  const posts: PostData[] = [];
  let profileInfo: ProfileInfo | null = null;

  // Detect screen type
  const screenType = detectScreen(nodes);

  // Extract posts from feed
  if (screenType === 'feed' || screenType === 'post') {
    extractPosts(nodes, posts);
  }

  // Extract profile info
  if (screenType === 'profile') {
    profileInfo = extractProfile(nodes);
  }

  return {
    timestamp: new Date().toISOString(),
    screen: screenType,
    posts,
    profileInfo,
    rawNodes: nodes,
  };
}

function detectScreen(nodes: UINode[]): string {
  const resourceIds = nodes.map(n => n.resourceId).join(' ');
  const texts = nodes.map(n => n.text.toLowerCase()).join(' ');

  if (resourceIds.includes('profile_header') || texts.includes('followers') && texts.includes('following')) {
    return 'profile';
  }
  if (resourceIds.includes('carousel') || resourceIds.includes('feed')) {
    return 'feed';
  }
  if (resourceIds.includes('row_feed_comment')) {
    return 'post';
  }
  return 'unknown';
}

function extractPosts(nodes: UINode[], posts: PostData[]): void {
  let currentPost: Partial<PostData> = {};

  for (const node of nodes) {
    const rid = node.resourceId;
    const text = node.text;
    const desc = node.contentDesc;

    // Username detection
    if (rid.includes('row_feed_photo_profile_name') || rid.includes('username')) {
      if (currentPost.username) {
        posts.push(finalizePost(currentPost));
        currentPost = {};
      }
      currentPost.username = text;
    }

    // Caption
    if (rid.includes('row_feed_comment_textview_layout') || rid.includes('caption')) {
      currentPost.caption = text;
    }

    // Likes
    if (desc && (desc.includes('like') || desc.includes('j\'aime'))) {
      currentPost.likes = desc;
    }
    if (text && (text.includes('like') || text.includes('j\'aime'))) {
      currentPost.likes = text;
    }

    // Comments count
    if (text && (text.includes('comment') || text.includes('commentaire'))) {
      currentPost.comments = text;
    }

    // Content descriptions (images, videos)
    if (desc && desc.length > 10) {
      if (!currentPost.contentDescriptions) currentPost.contentDescriptions = [];
      currentPost.contentDescriptions.push(desc);
    }
  }

  if (currentPost.username) {
    posts.push(finalizePost(currentPost));
  }
}

function extractProfile(nodes: UINode[]): ProfileInfo {
  const info: ProfileInfo = {
    username: '',
    fullName: '',
    bio: '',
    followers: '',
    following: '',
    posts: '',
  };

  for (const node of nodes) {
    const rid = node.resourceId;
    const text = node.text;
    const desc = node.contentDesc;

    if (rid.includes('action_bar_title') || rid.includes('username')) {
      info.username = text;
    }
    if (rid.includes('profile_header_full_name')) {
      info.fullName = text;
    }
    if (rid.includes('profile_header_bio_text')) {
      info.bio = text;
    }
    if (desc && desc.toLowerCase().includes('follower')) {
      info.followers = desc;
    }
    if (desc && desc.toLowerCase().includes('following')) {
      info.following = desc;
    }
    if (desc && desc.toLowerCase().includes('post')) {
      info.posts = desc;
    }
  }

  return info;
}

function finalizePost(partial: Partial<PostData>): PostData {
  return {
    username: partial.username || 'unknown',
    caption: partial.caption || '',
    likes: partial.likes || '',
    comments: partial.comments || '',
    timestamp: new Date().toISOString(),
    contentDescriptions: partial.contentDescriptions || [],
  };
}
