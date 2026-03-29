import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';
import { findAdbPath } from './adb-path';

const DATA_DIR = path.join(__dirname, '..', 'data');
const TAG = 'ECHA_DATA';

interface EchaEvent {
  timestamp: number;
  eventType: string;
  nodeCount: number;
  nodes: Array<{
    text: string;
    desc: string;
    class: string;
    resourceId: string;
    depth: number;
    clickable: boolean;
    scrollable: boolean;
    bounds: string;
  }>;
  imageDescriptions: string[];
}

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

export async function startLogcatListener(): Promise<void> {
  const adbPath = findAdbPath();
  const events: EchaEvent[] = [];
  const chunkBuffer: Map<string, string[]> = new Map();

  log('=== ECHA v2 — AccessibilityService Logcat Listener ===');
  log('Listening for Instagram accessibility events...');
  log('Scroll Instagram on your phone. Press Ctrl+C to stop and save.\n');

  // Clear logcat first
  const clear = spawn(adbPath, ['logcat', '-c']);
  await new Promise<void>(resolve => clear.on('close', resolve));

  // Start listening
  const logcat = spawn(adbPath, ['logcat', '-s', `${TAG}:I`, '*:S', '-v', 'raw']);

  logcat.stdout.on('data', (data: Buffer) => {
    const lines = data.toString('utf-8').split('\n').filter(l => l.trim());

    for (const line of lines) {
      processLine(line.trim(), events, chunkBuffer);
    }
  });

  logcat.stderr.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) log(`[stderr] ${msg}`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('\nStopping listener...');
    logcat.kill();

    if (events.length > 0) {
      const outPath = path.join(DATA_DIR, `accessibility_extract_${Date.now()}.json`);
      writeFileSync(outPath, JSON.stringify(events, null, 2), 'utf-8');
      log(`Saved ${events.length} events to ${outPath}`);

      // Summary
      const allImageDescs = events.flatMap(e => e.imageDescriptions || []);
      const uniqueDescs = [...new Set(allImageDescs)];
      log(`\n=== SUMMARY ===`);
      log(`Total events: ${events.length}`);
      log(`Total nodes captured: ${events.reduce((s, e) => s + (e.nodeCount || 0), 0)}`);
      log(`Unique image descriptions: ${uniqueDescs.length}`);
      if (uniqueDescs.length > 0) {
        log('\nImage descriptions:');
        for (const desc of uniqueDescs) {
          console.log(`  -> ${desc}`);
        }
      }
    } else {
      log('No events captured.');
    }

    process.exit(0);
  });

  // Keep alive
  await new Promise(() => {});
}

function processLine(
  line: string,
  events: EchaEvent[],
  chunkBuffer: Map<string, string[]>
): void {
  if (!line || line.startsWith('-----')) return;

  // Service lifecycle events
  if (line.startsWith('SERVICE_STARTED')) {
    log('AccessibilityService connected on device');
    return;
  }
  if (line.startsWith('SERVICE_INTERRUPTED') || line.startsWith('SERVICE_DESTROYED')) {
    log(`Service: ${line}`);
    return;
  }
  if (line.startsWith('ERROR')) {
    log(`Error from service: ${line}`);
    return;
  }

  // Single data event (small enough for one line)
  if (line.startsWith('DATA|')) {
    const json = line.substring(5);
    try {
      const event = JSON.parse(json) as EchaEvent;
      handleEvent(event, events);
    } catch {
      // Might be truncated, ignore
    }
    return;
  }

  // Chunked data
  if (line.startsWith('CHUNK|')) {
    const parts = line.split('|');
    if (parts.length >= 4) {
      const index = parseInt(parts[1], 10);
      const total = parseInt(parts[2], 10);
      const chunk = parts.slice(3).join('|'); // rejoin in case chunk contains |
      const key = `chunk_${total}`;

      if (!chunkBuffer.has(key)) {
        chunkBuffer.set(key, new Array(total).fill(''));
      }
      const chunks = chunkBuffer.get(key)!;
      chunks[index] = chunk;
    }
    return;
  }

  // End marker — reconstruct chunked data
  if (line.startsWith('END|')) {
    for (const [_key, chunks] of chunkBuffer.entries()) {
      if (chunks.every(c => c !== '')) {
        const json = chunks.join('');
        try {
          const event = JSON.parse(json) as EchaEvent;
          handleEvent(event, events);
        } catch {
          log(`Failed to parse chunked JSON (${json.length} chars)`);
        }
      }
    }
    chunkBuffer.clear();
    return;
  }
}

function handleEvent(event: EchaEvent, events: EchaEvent[]): void {
  events.push(event);

  const nodeCount = event.nodeCount || 0;
  const imgDescs = event.imageDescriptions || [];
  const eventType = event.eventType || 'unknown';

  log(`Event #${events.length} [${eventType}] — ${nodeCount} nodes, ${imgDescs.length} image descriptions`);

  // Show image descriptions
  if (imgDescs.length > 0) {
    for (const desc of imgDescs) {
      console.log(`  [img] ${desc.substring(0, 150)}`);
    }
  }

  // Show key text content
  const nodes = event.nodes || [];
  const texts = nodes
    .filter(n => n.text && n.text.length > 3)
    .map(n => n.text)
    .slice(0, 10);

  if (texts.length > 0) {
    for (const text of texts) {
      console.log(`  [txt] ${text.substring(0, 100)}`);
    }
  }

  console.log('');
}
