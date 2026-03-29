"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCollective = computeCollective;
function computeCollective(positions) {
    if (positions.length === 0)
        return { valence: 0, energy: 0 };
    const valence = positions.reduce((sum, p) => sum + p.valence, 0) / positions.length;
    const energy = positions.reduce((sum, p) => sum + p.energy, 0) / positions.length;
    return { valence, energy };
}
//# sourceMappingURL=compute-collective.js.map