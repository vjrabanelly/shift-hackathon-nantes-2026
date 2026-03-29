"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchMusicCandidates = searchMusicCandidates;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
async function searchMusicCandidates(context) {
    const scriptPath = node_path_1.default.resolve(process.cwd(), '../../services/music-agent/search_service.py');
    if (!(0, node_fs_1.existsSync)(scriptPath)) {
        return {
            candidates: [],
            search_traces: [
                {
                    id: 'agent:web:missing-script',
                    agent: 'agent-web',
                    tool: 'music search',
                    status: 'failed',
                    query: context.query,
                    summary: "Le service de recherche musicale n'est pas disponible sur ce serveur."
                }
            ]
        };
    }
    try {
        const result = await runPythonProcess(scriptPath, context);
        return {
            candidates: result.candidates ?? [],
            search_traces: result.search_traces ?? []
        };
    }
    catch {
        return {
            candidates: [],
            search_traces: [
                {
                    id: 'agent:web:python-failed',
                    agent: 'agent-web',
                    tool: 'music search',
                    status: 'failed',
                    query: context.query,
                    summary: 'La recherche musicale a échoué avant de pouvoir proposer un morceau.'
                }
            ]
        };
    }
}
function runPythonProcess(scriptPath, payload) {
    return new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)('python3', [scriptPath], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe']
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => {
            stdout += String(chunk);
        });
        child.stderr.on('data', (chunk) => {
            stderr += String(chunk);
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr || `music agent exited with code ${String(code)}`));
                return;
            }
            try {
                resolve(JSON.parse(stdout));
            }
            catch (error) {
                reject(error);
            }
        });
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
    });
}
//# sourceMappingURL=music-agent.js.map