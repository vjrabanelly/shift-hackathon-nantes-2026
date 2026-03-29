"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnvFromProjectRoot = loadEnvFromProjectRoot;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
function loadEnvFromProjectRoot() {
    const envPath = findNearestEnv(process.cwd());
    if (!envPath) {
        return;
    }
    const raw = (0, node_fs_1.readFileSync)(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex <= 0) {
            continue;
        }
        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
}
function findNearestEnv(startDir) {
    let current = node_path_1.default.resolve(startDir);
    for (;;) {
        const candidate = node_path_1.default.join(current, '.env');
        if ((0, node_fs_1.existsSync)(candidate)) {
            return candidate;
        }
        const parent = node_path_1.default.dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
}
//# sourceMappingURL=env.js.map