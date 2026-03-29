import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startDaemon, stopDaemon, getDaemonStatus } from '../daemon';

// Mock prisma
vi.mock('../../db/client', () => ({
  default: {
    post: {
      count: vi.fn(),
    },
  },
}));

// Mock pipeline
vi.mock('../pipeline', () => ({
  enrichBatch: vi.fn(),
}));

import prisma from '../../db/client';
import { enrichBatch } from '../pipeline';

const mockCount = vi.mocked(prisma.post.count);
const mockEnrichBatch = vi.mocked(enrichBatch);

const dummyProvider = {
  name: 'test',
  call: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEnrichBatch.mockResolvedValue({ processed: 5, succeeded: 4, failed: 0, skipped: 1 });
});

afterEach(async () => {
  await stopDaemon();
});

describe('daemon', () => {
  it('ne déclenche pas si posts < threshold', async () => {
    mockCount.mockResolvedValue(1);

    await startDaemon({
      intervalMs: 60_000,
      threshold: 3,
      enrichmentOptions: { llmProvider: dummyProvider },
    });

    const status = getDaemonStatus();
    expect(status.running).toBe(true);
    expect(status.totalBatches).toBe(0);
    expect(mockEnrichBatch).not.toHaveBeenCalled();
  });

  it('déclenche enrichBatch quand posts >= threshold', async () => {
    mockCount.mockResolvedValue(10);

    await startDaemon({
      intervalMs: 60_000,
      threshold: 3,
      batchSize: 20,
      enrichmentOptions: { llmProvider: dummyProvider },
    });

    const status = getDaemonStatus();
    expect(status.totalBatches).toBe(1);
    expect(status.totalSucceeded).toBe(4);
    expect(status.totalSkipped).toBe(1);
    expect(mockEnrichBatch).toHaveBeenCalledWith(
      expect.objectContaining({ batchSize: 20, dryRun: false }),
    );
  });

  it('stopDaemon arrête proprement', async () => {
    mockCount.mockResolvedValue(0);

    await startDaemon({
      intervalMs: 60_000,
      enrichmentOptions: { llmProvider: dummyProvider },
    });

    await stopDaemon();
    const status = getDaemonStatus();
    expect(status.running).toBe(false);
  });

  it('gère les erreurs sans crash', async () => {
    mockCount.mockRejectedValueOnce(new Error('DB down'));

    await startDaemon({
      intervalMs: 60_000,
      enrichmentOptions: { llmProvider: dummyProvider },
    });

    const status = getDaemonStatus();
    expect(status.running).toBe(true);
    expect(status.consecutiveErrors).toBe(1);
  });

  it('appelle onStatusChange callback', async () => {
    mockCount.mockResolvedValue(5);
    const onStatusChange = vi.fn();

    await startDaemon({
      intervalMs: 60_000,
      threshold: 3,
      enrichmentOptions: { llmProvider: dummyProvider },
      onStatusChange,
    });

    expect(onStatusChange).toHaveBeenCalled();
    const lastStatus = onStatusChange.mock.calls.at(-1)?.[0];
    expect(lastStatus.totalBatches).toBeGreaterThanOrEqual(1);
  });
});
