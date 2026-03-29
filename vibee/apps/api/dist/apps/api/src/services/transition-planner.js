"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransitionPlanner = void 0;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const PROJECT_ROOT = node_path_1.default.resolve(__dirname, '../../../../');
const PYTHON_BIN = process.env.PYTHON_BIN ?? (process.platform === 'win32' ? 'python' : 'python3');
class TransitionPlanner {
    cache = new Map();
    async plan(source, target) {
        const sourceInput = this.resolveInput(source);
        const targetInput = this.resolveInput(target);
        if (!sourceInput || !targetInput) {
            return null;
        }
        const cacheKey = `${source.id}:${sourceInput}::${target.id}:${targetInput}`;
        const existing = this.cache.get(cacheKey);
        if (existing) {
            return existing;
        }
        const pending = this.run(sourceInput, targetInput)
            .catch((error) => {
            this.cache.delete(cacheKey);
            console.error(`[TransitionPlanner] Failed to plan ${source.title} -> ${target.title}:`, error);
            return null;
        });
        this.cache.set(cacheKey, pending);
        return pending;
    }
    resolveInput(track) {
        if (track.file_path && node_fs_1.default.existsSync(track.file_path)) {
            return track.file_path;
        }
        if (track.youtube_id) {
            return `https://www.youtube.com/watch?v=${track.youtube_id}`;
        }
        return null;
    }
    run(source, target) {
        return new Promise((resolve, reject) => {
            const child = (0, node_child_process_1.spawn)(PYTHON_BIN, ['-m', 'services.transition_cli'], {
                cwd: PROJECT_ROOT,
                env: process.env,
            });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (chunk) => {
                stdout += chunk.toString();
            });
            child.stderr.on('data', (chunk) => {
                stderr += chunk.toString();
            });
            child.on('error', (error) => {
                reject(error);
            });
            child.on('close', (code) => {
                const trimmed = stdout.trim();
                let payload = null;
                if (trimmed) {
                    try {
                        payload = JSON.parse(trimmed);
                    }
                    catch (error) {
                        reject(new Error(`Transition planner returned invalid JSON: ${error instanceof Error ? error.message : String(error)}\n${trimmed.slice(0, 1000)}`));
                        return;
                    }
                }
                if (code !== 0 || !payload?.ok) {
                    const detail = payload?.error ?? stderr.trim() ?? `exit ${code}`;
                    reject(new Error(detail));
                    return;
                }
                const candidate = payload.candidate;
                if (!candidate?.preview_path || !node_fs_1.default.existsSync(candidate.preview_path)) {
                    resolve(null);
                    return;
                }
                resolve({
                    score: Number(candidate.score ?? 0),
                    transitionType: candidate.transition_type ?? 'transition',
                    previewPath: candidate.preview_path,
                    components: candidate.components ?? {},
                    reasons: candidate.reasons ?? [],
                    sourceWindow: {
                        start: Number(candidate.source_segment?.start ?? 0),
                        end: Number(candidate.source_segment?.end ?? 0),
                        duration: Number(candidate.source_segment?.duration ?? 0),
                    },
                    targetWindow: {
                        start: Number(candidate.target_segment?.start ?? 0),
                        end: Number(candidate.target_segment?.end ?? 0),
                        duration: Number(candidate.target_segment?.duration ?? 0),
                    },
                });
            });
            child.stdin.end(JSON.stringify({ source, target }));
        });
    }
}
exports.TransitionPlanner = TransitionPlanner;
//# sourceMappingURL=transition-planner.js.map