/**
 * Tests for mobile WebSocket message handling in the visualizer.
 * Tests the message parsing/routing logic without spinning up actual servers.
 */

import { describe, it, expect } from 'vitest';

// ── Message parsing helpers (extracted logic) ────────────────────

interface MobileMessage {
  type: string;
  data: any;
}

function parseMobileMessage(raw: string): MobileMessage | null {
  try {
    const msg = JSON.parse(raw);
    if (!msg.type || !msg.type.startsWith('mobile:')) return null;
    return msg as MobileMessage;
  } catch {
    return null;
  }
}

function classifyAttention(ms: number): string {
  if (ms < 500) return 'skipped';
  if (ms < 2000) return 'glanced';
  if (ms < 5000) return 'viewed';
  return 'engaged';
}

function buildPostKey(sessionId: string, username: string, postId: string): string {
  return `${sessionId}:${username}:${postId}`;
}

// ── Tests ────────��───────────────────────────────────────────────

describe('mobile WS message parsing', () => {
  it('parses valid mobile:hello message', () => {
    const raw = JSON.stringify({
      type: 'mobile:hello',
      data: { totalSessions: 5, totalPosts: 120, totalEnriched: 80 },
    });
    const msg = parseMobileMessage(raw);
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe('mobile:hello');
    expect(msg!.data.totalSessions).toBe(5);
  });

  it('parses valid mobile:post message', () => {
    const raw = JSON.stringify({
      type: 'mobile:post',
      data: {
        sessionId: '123456',
        post: {
          postId: 'abc',
          username: 'testuser',
          caption: 'Hello world #test',
          mediaType: 'photo',
          dwellTimeMs: 3500,
        },
      },
    });
    const msg = parseMobileMessage(raw);
    expect(msg).not.toBeNull();
    expect(msg!.data.post.username).toBe('testuser');
    expect(msg!.data.post.dwellTimeMs).toBe(3500);
  });

  it('parses valid mobile:dwell message', () => {
    const raw = JSON.stringify({
      type: 'mobile:dwell',
      data: { sessionId: '123', postId: 'abc', username: 'user1', dwellTimeMs: 7200 },
    });
    const msg = parseMobileMessage(raw);
    expect(msg).not.toBeNull();
    expect(msg!.data.dwellTimeMs).toBe(7200);
  });

  it('returns null for non-mobile messages', () => {
    const raw = JSON.stringify({ type: 'event', data: {} });
    expect(parseMobileMessage(raw)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseMobileMessage('not json')).toBeNull();
    expect(parseMobileMessage('')).toBeNull();
    expect(parseMobileMessage('{bad')).toBeNull();
  });

  it('returns null for messages without type', () => {
    const raw = JSON.stringify({ data: { foo: 'bar' } });
    expect(parseMobileMessage(raw)).toBeNull();
  });
});

describe('attention classification', () => {
  it('classifies skipped (< 500ms)', () => {
    expect(classifyAttention(0)).toBe('skipped');
    expect(classifyAttention(200)).toBe('skipped');
    expect(classifyAttention(499)).toBe('skipped');
  });

  it('classifies glanced (500-2000ms)', () => {
    expect(classifyAttention(500)).toBe('glanced');
    expect(classifyAttention(1500)).toBe('glanced');
    expect(classifyAttention(1999)).toBe('glanced');
  });

  it('classifies viewed (2000-5000ms)', () => {
    expect(classifyAttention(2000)).toBe('viewed');
    expect(classifyAttention(3500)).toBe('viewed');
    expect(classifyAttention(4999)).toBe('viewed');
  });

  it('classifies engaged (>= 5000ms)', () => {
    expect(classifyAttention(5000)).toBe('engaged');
    expect(classifyAttention(15000)).toBe('engaged');
  });
});

describe('post key generation', () => {
  it('builds correct composite key', () => {
    expect(buildPostKey('sess1', 'user1', 'post1')).toBe('sess1:user1:post1');
  });

  it('handles empty values', () => {
    expect(buildPostKey('', '', '')).toBe('::');
  });

  it('handles special characters in username', () => {
    expect(buildPostKey('sess1', 'user.name_123', 'post1')).toBe('sess1:user.name_123:post1');
  });
});

describe('mobile message types coverage', () => {
  const messageTypes = [
    'mobile:hello',
    'mobile:session-start',
    'mobile:session-end',
    'mobile:post',
    'mobile:dwell',
    'mobile:mlkit',
    'mobile:enrichment',
    'mobile:pong',
  ];

  for (const type of messageTypes) {
    it(`recognizes ${type} as valid mobile message`, () => {
      const raw = JSON.stringify({ type, data: {} });
      const msg = parseMobileMessage(raw);
      expect(msg).not.toBeNull();
      expect(msg!.type).toBe(type);
    });
  }
});

describe('mobile:session-start message', () => {
  it('includes required fields', () => {
    const raw = JSON.stringify({
      type: 'mobile:session-start',
      data: {
        sessionId: '1711612345678',
        captureMode: 'webview',
        timestamp: 1711612345678,
      },
    });
    const msg = parseMobileMessage(raw);
    expect(msg!.data.sessionId).toBe('1711612345678');
    expect(msg!.data.captureMode).toBe('webview');
    expect(msg!.data.timestamp).toBe(1711612345678);
  });
});

describe('mobile:session-end message', () => {
  it('includes stats', () => {
    const raw = JSON.stringify({
      type: 'mobile:session-end',
      data: {
        sessionId: '1711612345678',
        durationSec: 120.5,
        totalPosts: 25,
        totalEvents: 142,
      },
    });
    const msg = parseMobileMessage(raw);
    expect(msg!.data.durationSec).toBe(120.5);
    expect(msg!.data.totalPosts).toBe(25);
  });
});
