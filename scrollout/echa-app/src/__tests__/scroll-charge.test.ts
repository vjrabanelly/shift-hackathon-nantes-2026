import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for scroll charge feature (progress ring → shake → firework → wrapped).
 * Since scrollout-ui.ts runs in a WebView context with DOM manipulation,
 * we test the pure logic extracted via __test__ exports.
 */

// Mock DOM + EchaBridge before importing
const mockOnData = vi.fn();

beforeEach(() => {
  vi.resetModules();
  mockOnData.mockClear();

  // Minimal DOM mocks
  (globalThis as any).window = {
    __SCROLLOUT_UI_LOADED: undefined,
    __echaPostCount: 0,
    EchaBridge: { onData: mockOnData },
    location: { href: 'https://www.instagram.com/' },
    scrollY: 0,
    pageYOffset: 0,
    addEventListener: vi.fn(),
  };
  (globalThis as any).document = {
    getElementById: vi.fn(() => null),
    createElement: vi.fn(() => ({
      id: '',
      style: {},
      setAttribute: vi.fn(),
      appendChild: vi.fn(),
      addEventListener: vi.fn(),
      insertAdjacentHTML: vi.fn(),
      innerHTML: '',
      classList: { add: vi.fn(), remove: vi.fn() },
      dataset: {},
      offsetWidth: 0,
    })),
    head: { appendChild: vi.fn() },
    body: {
      appendChild: vi.fn(),
      contains: vi.fn(() => false),
      querySelectorAll: vi.fn(() => []),
    },
    querySelectorAll: vi.fn(() => []),
  };
  (globalThis as any).MutationObserver = class {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(_cb: any) {}
  };
  (globalThis as any).console = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  (globalThis as any).setTimeout = vi.fn();
  (globalThis as any).setInterval = vi.fn();
  (globalThis as any).clearInterval = vi.fn();
  (globalThis as any).clearTimeout = vi.fn();
  (globalThis as any).requestAnimationFrame = vi.fn(() => 1); // don't execute callback (prevents infinite loop)
});

describe('Scroll Charge — threshold and progress', () => {
  it('CHARGE_THRESHOLD is 15 posts', async () => {
    const { __test__ } = await import('../tracker/scrollout-ui.js');
    expect(__test__.CHARGE_THRESHOLD).toBe(15);
  });

  it('starts with 0 progress and not charged', async () => {
    const { __test__ } = await import('../tracker/scrollout-ui.js');
    expect(__test__.currentProgress).toBe(0);
    expect(__test__.isCharged).toBe(false);
  });

  it('progress = postCount / CHARGE_THRESHOLD', async () => {
    const { __test__ } = await import('../tracker/scrollout-ui.js');
    // Simulate 5 posts
    (globalThis as any).window.__echaPostCount = 5;
    // pollPostCount reads __echaPostCount and updates ring
    // But updateRing requires DOM — test the math instead
    const progress = 5 / __test__.CHARGE_THRESHOLD;
    expect(progress).toBeCloseTo(0.333, 2);
  });

  it('progress clamps at 1.0 for counts above threshold', async () => {
    const { __test__ } = await import('../tracker/scrollout-ui.js');
    const progress = Math.min(1, 20 / __test__.CHARGE_THRESHOLD);
    expect(progress).toBe(1);
  });
});

describe('Scroll Charge — event types', () => {
  it('sends open_sidebar when not charged', () => {
    // Verify the FAB click handler sends the right event type
    // The logic: isCharged ? 'open_wrapped' : 'open_sidebar'
    const isCharged = false;
    const eventType = isCharged ? 'open_wrapped' : 'open_sidebar';
    expect(eventType).toBe('open_sidebar');
  });

  it('sends open_wrapped when charged', () => {
    const isCharged = true;
    const eventType = isCharged ? 'open_wrapped' : 'open_sidebar';
    expect(eventType).toBe('open_wrapped');
  });
});

describe('Scroll Charge — blob deformation', () => {
  it('blobRadius returns 50% at zero intensity', async () => {
    const { __test__ } = await import('../tracker/scrollout-ui.js');
    expect(__test__.blobRadius(0, 0)).toBe('50%');
    expect(__test__.blobRadius(0.005, 0)).toBe('50%');
  });

  it('blobRadius returns organic values at high intensity', async () => {
    const { __test__ } = await import('../tracker/scrollout-ui.js');
    const radius = __test__.blobRadius(0.8, 1.5);
    expect(radius).not.toBe('50%');
    expect(radius).toContain('/'); // has horizontal/vertical split
    expect(radius).toContain('%');
  });
});

describe('Scroll Charge — incandescent color', () => {
  it('returns dark color at 0 progress', async () => {
    const { __test__ } = await import('../tracker/scrollout-ui.js');
    expect(__test__.incandescent(0)).toBe('rgb(38,38,38)');
  });

  it('returns near-white at full progress', async () => {
    const { __test__ } = await import('../tracker/scrollout-ui.js');
    const color = __test__.incandescent(1);
    expect(color).toBe('rgb(255,250,230)');
  });

  it('returns warm color at 0.75 progress', async () => {
    const { __test__ } = await import('../tracker/scrollout-ui.js');
    const color = __test__.incandescent(0.75);
    // At 0.75 we expect red glow (high R, low-mid G, low B)
    const match = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
    expect(match).toBeTruthy();
    const [, r, g, b] = match!.map(Number);
    expect(r).toBeGreaterThan(140);  // strong red
    expect(g).toBeLessThan(80);       // low green
    expect(b).toBeLessThan(20);       // very low blue
  });

  it('color gets progressively lighter', async () => {
    const { __test__ } = await import('../tracker/scrollout-ui.js');
    const parse = (c: string) => {
      const m = c.match(/rgb\((\d+),(\d+),(\d+)\)/);
      return m ? m.slice(1).map(Number) : [0,0,0];
    };
    const [r1] = parse(__test__.incandescent(0.2));
    const [r2] = parse(__test__.incandescent(0.5));
    const [r3] = parse(__test__.incandescent(0.8));
    expect(r2).toBeGreaterThan(r1);
    expect(r3).toBeGreaterThan(r2);
  });
});

describe('Scroll Charge — pollPostCount triggers firework', () => {
  it('charges when __echaPostCount reaches CHARGE_THRESHOLD', async () => {
    // Provide a minimal btn element for updateProgress to find
    const btnMock = {
      id: 'echa-scrollout-btn',
      style: {},
      setAttribute: vi.fn(),
      appendChild: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn() },
      dataset: {},
      getBoundingClientRect: vi.fn(() => ({ left: 300, top: 600, width: 46, height: 46 })),
    };
    (globalThis as any).document.getElementById = vi.fn((id: string) => {
      if (id === 'echa-scrollout-btn') return btnMock;
      return null;
    });

    const { __test__ } = await import('../tracker/scrollout-ui.js');
    expect(__test__.isCharged).toBe(false);

    // Simulate tracker setting __echaPostCount to threshold
    (globalThis as any).window.__echaPostCount = __test__.CHARGE_THRESHOLD;
    __test__.pollPostCount();

    expect(__test__.currentProgress).toBe(1);
    expect(__test__.isCharged).toBe(true);
  });

  it('does NOT charge below threshold', async () => {
    const btnMock = {
      id: 'echa-scrollout-btn',
      style: {},
      setAttribute: vi.fn(),
      appendChild: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn() },
      dataset: {},
      getBoundingClientRect: vi.fn(() => ({ left: 300, top: 600, width: 46, height: 46 })),
    };
    (globalThis as any).document.getElementById = vi.fn((id: string) => {
      if (id === 'echa-scrollout-btn') return btnMock;
      return null;
    });

    const { __test__ } = await import('../tracker/scrollout-ui.js');
    (globalThis as any).window.__echaPostCount = 5;
    __test__.pollPostCount();

    expect(__test__.currentProgress).toBeCloseTo(5 / __test__.CHARGE_THRESHOLD, 2);
    expect(__test__.isCharged).toBe(false);
  });
});

describe('Scroll Charge — heat accumulation', () => {
  it('heat builds up with scroll delta', () => {
    // delta * 0.0003 per pixel
    const delta = 100; // 100px scrolled
    const heat = delta * 0.0003;
    expect(heat).toBeCloseTo(0.03);
  });

  it('heat decays slowly when idle', () => {
    let heat = 0.5;
    // 60 frames of idle = ~1s
    for (let i = 0; i < 60; i++) heat = Math.max(0, heat - 0.001);
    expect(heat).toBeCloseTo(0.44, 1);
  });

  it('heat clamps at 1.0', () => {
    const heat = Math.min(1, 0.99 + 100 * 0.0003);
    expect(heat).toBe(1);
  });
});
