"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const compute_collective_1 = require("../compute-collective");
(0, vitest_1.describe)('computeCollective', () => {
    (0, vitest_1.it)('returns neutral position for empty array', () => {
        (0, vitest_1.expect)((0, compute_collective_1.computeCollective)([])).toEqual({ valence: 0, energy: 0 });
    });
    (0, vitest_1.it)('returns single position unchanged', () => {
        (0, vitest_1.expect)((0, compute_collective_1.computeCollective)([{ valence: 0.5, energy: -0.3 }])).toEqual({ valence: 0.5, energy: -0.3 });
    });
    (0, vitest_1.it)('computes arithmetic mean of two positions', () => {
        const result = (0, compute_collective_1.computeCollective)([
            { valence: 0.8, energy: 0.6 },
            { valence: 0.4, energy: 0.2 },
        ]);
        (0, vitest_1.expect)(result.valence).toBeCloseTo(0.6);
        (0, vitest_1.expect)(result.energy).toBeCloseTo(0.4);
    });
    (0, vitest_1.it)('handles negative values correctly', () => {
        const result = (0, compute_collective_1.computeCollective)([
            { valence: -1, energy: -0.5 },
            { valence: 1, energy: 0.5 },
        ]);
        (0, vitest_1.expect)(result.valence).toBeCloseTo(0);
        (0, vitest_1.expect)(result.energy).toBeCloseTo(0);
    });
    (0, vitest_1.it)('averages multiple positions', () => {
        const result = (0, compute_collective_1.computeCollective)([
            { valence: 0, energy: 0 },
            { valence: 0.6, energy: 0.9 },
            { valence: 0.3, energy: 0.3 },
        ]);
        (0, vitest_1.expect)(result.valence).toBeCloseTo(0.3);
        (0, vitest_1.expect)(result.energy).toBeCloseTo(0.4);
    });
});
//# sourceMappingURL=compute-collective.test.js.map