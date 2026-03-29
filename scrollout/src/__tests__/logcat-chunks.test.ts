import { describe, it, expect } from 'vitest';
import { LogcatTap, MLKitResult } from '../logcat-tap';

// We test the chunk parsing logic by calling processLine directly
// LogcatTap.processLine is private, so we access it via prototype hack
function createTap(): LogcatTap & { processLine(line: string): void } {
  const tap = new LogcatTap();
  return tap as any;
}

describe('Chunk reassembly', () => {
  it('reassembles v2 chunks with sequence ID', () => {
    const tap = createTap();
    const events: any[] = [];
    tap.on('event', (e: any) => events.push(e));

    const payload = JSON.stringify({ timestamp: 123, eventType: 'CONTENT_CHANGED', screenType: 'feed', nodeCount: 0 });
    const mid = Math.floor(payload.length / 2);
    const chunk0 = payload.substring(0, mid);
    const chunk1 = payload.substring(mid);

    tap.processLine(`CHUNK|0|0|2|${chunk0}`);
    tap.processLine(`CHUNK|0|1|2|${chunk1}`);
    tap.processLine('END|0|999');

    expect(events).toHaveLength(1);
    expect(events[0].timestamp).toBe(123);
    expect(events[0].eventType).toBe('CONTENT_CHANGED');
  });

  it('handles concurrent v2 chunks with different seqIds', () => {
    const tap = createTap();
    const events: any[] = [];
    tap.on('event', (e: any) => events.push(e));

    const payloadA = JSON.stringify({ timestamp: 111, eventType: 'A', screenType: 'feed', nodeCount: 0 });
    const payloadB = JSON.stringify({ timestamp: 222, eventType: 'B', screenType: 'feed', nodeCount: 0 });
    const midA = Math.floor(payloadA.length / 2);
    const midB = Math.floor(payloadB.length / 2);

    // Interleaved chunks from two different events
    tap.processLine(`CHUNK|10|0|2|${payloadA.substring(0, midA)}`);
    tap.processLine(`CHUNK|11|0|2|${payloadB.substring(0, midB)}`);
    tap.processLine(`CHUNK|10|1|2|${payloadA.substring(midA)}`);
    tap.processLine(`CHUNK|11|1|2|${payloadB.substring(midB)}`);
    tap.processLine('END|10|999');
    tap.processLine('END|11|999');

    expect(events).toHaveLength(2);
    expect(events[0].timestamp).toBe(111);
    expect(events[1].timestamp).toBe(222);
  });

  it('handles legacy v1 chunks (backward compat)', () => {
    const tap = createTap();
    const events: any[] = [];
    tap.on('event', (e: any) => events.push(e));

    const payload = JSON.stringify({ timestamp: 456, eventType: 'SCROLLED', screenType: 'feed', nodeCount: 5 });
    const mid = Math.floor(payload.length / 2);

    tap.processLine(`CHUNK|0|2|${payload.substring(0, mid)}`);
    tap.processLine(`CHUNK|1|2|${payload.substring(mid)}`);
    tap.processLine('END|999');

    expect(events).toHaveLength(1);
    expect(events[0].timestamp).toBe(456);
  });

  it('reports error on incomplete chunks', () => {
    const tap = createTap();
    const errors: any[] = [];
    tap.on('error', (e: any) => errors.push(e));

    tap.processLine('CHUNK|5|0|3|partial');
    tap.processLine('CHUNK|5|2|3|data');
    // Missing chunk index 1
    tap.processLine('END|5|999');

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('incomplete');
  });

  it('parses single DATA| lines without chunking', () => {
    const tap = createTap();
    const events: any[] = [];
    tap.on('event', (e: any) => events.push(e));

    const payload = JSON.stringify({ timestamp: 789, eventType: 'STATE_CHANGED', screenType: 'profile', nodeCount: 3 });
    tap.processLine(`DATA|${payload}`);

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('STATE_CHANGED');
  });
});

describe('MLKit parsing', () => {
  it('parses MLKIT| lines and emits mlkit event', () => {
    const tap = createTap();
    const results: MLKitResult[] = [];
    tap.on('mlkit', (r: MLKitResult) => results.push(r));

    const payload: MLKitResult = {
      postId: 'user123|abc',
      labels: [{ text: 'text', confidence: 0.95 }, { text: 'person', confidence: 0.8 }],
      ocrText: 'Ceci est du texte incrusté dans la vidéo',
      processingMs: 42,
    };
    tap.processLine(`MLKIT|${JSON.stringify(payload)}`);

    expect(results).toHaveLength(1);
    expect(results[0].postId).toBe('user123|abc');
    expect(results[0].ocrText).toBe('Ceci est du texte incrusté dans la vidéo');
    expect(results[0].labels).toHaveLength(2);
    expect(results[0].labels[0].text).toBe('text');
  });

  it('parses ECHA_MLKIT| prefixed lines', () => {
    const tap = createTap();
    const results: MLKitResult[] = [];
    tap.on('mlkit', (r: MLKitResult) => results.push(r));

    const payload: MLKitResult = { postId: 'test|xyz', labels: [], ocrText: 'overlay text', processingMs: 10 };
    tap.processLine(`ECHA_MLKIT|${JSON.stringify(payload)}`);

    expect(results).toHaveLength(1);
    expect(results[0].ocrText).toBe('overlay text');
  });

  it('increments mlkitResults metric on valid parse', () => {
    const tap = createTap();
    tap.on('mlkit', () => {}); // consume

    const payload: MLKitResult = { postId: 'a|b', labels: [], ocrText: '', processingMs: 5 };
    tap.processLine(`MLKIT|${JSON.stringify(payload)}`);
    tap.processLine(`MLKIT|${JSON.stringify(payload)}`);

    const metrics = tap.getMetrics();
    expect(metrics.mlkitResults).toBe(2);
  });
});
