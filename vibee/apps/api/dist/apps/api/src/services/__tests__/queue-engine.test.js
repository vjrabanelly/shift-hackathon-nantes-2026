"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
vitest_1.vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: vitest_1.vi.fn(),
    },
}));
const queue_engine_1 = require("../queue-engine");
(0, vitest_1.describe)('QueueEngine', () => {
    (0, vitest_1.describe)('getInstance', () => {
        (0, vitest_1.it)('returns the same instance every time', () => {
            const a = queue_engine_1.QueueEngine.getInstance();
            const b = queue_engine_1.QueueEngine.getInstance();
            (0, vitest_1.expect)(a).toBe(b);
        });
    });
    (0, vitest_1.describe)('computeCollective', () => {
        const qe = queue_engine_1.QueueEngine.getInstance();
        (0, vitest_1.it)('returns {0,0} for empty array', () => {
            (0, vitest_1.expect)(qe.computeCollective([])).toEqual({ valence: 0, energy: 0 });
        });
        (0, vitest_1.it)('returns the single position unchanged', () => {
            (0, vitest_1.expect)(qe.computeCollective([{ valence: 0.5, energy: 0.8 }])).toEqual({
                valence: 0.5,
                energy: 0.8,
            });
        });
        (0, vitest_1.it)('averages multiple positions', () => {
            const result = qe.computeCollective([
                { valence: 0.5, energy: 0.3 },
                { valence: -0.5, energy: 0.7 },
            ]);
            (0, vitest_1.expect)(result.valence).toBeCloseTo(0);
            (0, vitest_1.expect)(result.energy).toBeCloseTo(0.5);
        });
        (0, vitest_1.it)('handles three positions', () => {
            const result = qe.computeCollective([
                { valence: 0.6, energy: 0.2 },
                { valence: 0.9, energy: 0.8 },
                { valence: 0.3, energy: 0.5 },
            ]);
            (0, vitest_1.expect)(result.valence).toBeCloseTo(0.6);
            (0, vitest_1.expect)(result.energy).toBeCloseTo(0.5);
        });
        (0, vitest_1.it)('handles negative valence values', () => {
            const result = qe.computeCollective([
                { valence: -0.5, energy: -0.3 },
                { valence: -0.1, energy: -0.7 },
            ]);
            (0, vitest_1.expect)(result.valence).toBeCloseTo(-0.3);
            (0, vitest_1.expect)(result.energy).toBeCloseTo(-0.5);
        });
    });
    (0, vitest_1.describe)('reorder', () => {
        (0, vitest_1.it)('resolves without error when no candidates exist', async () => {
            const { supabase } = await Promise.resolve().then(() => __importStar(require('../../lib/supabase')));
            const makeChain = (resolveValue) => {
                const chain = {};
                const methods = ['select', 'eq', 'not', 'gte', 'order'];
                for (const m of methods) {
                    chain[m] = vitest_1.vi.fn().mockImplementation(() => {
                        // Return a thenable for the last call, otherwise return chain
                        const proxy = new Proxy(chain, {
                            get(target, prop) {
                                if (prop === 'then') {
                                    return (resolve) => resolve(resolveValue);
                                }
                                return target[prop];
                            },
                        });
                        return proxy;
                    });
                }
                return chain;
            };
            supabase.from.mockImplementation(() => makeChain({ data: [] }));
            const qe = queue_engine_1.QueueEngine.getInstance();
            await (0, vitest_1.expect)(qe.reorder('test-event-id')).resolves.toBeUndefined();
        });
    });
});
//# sourceMappingURL=queue-engine.test.js.map