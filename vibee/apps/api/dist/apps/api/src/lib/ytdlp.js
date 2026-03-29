"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPlayableAudioFile = isPlayableAudioFile;
exports.searchYouTube = searchYouTube;
exports.downloadYouTube = downloadYouTube;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const media_paths_1 = require("./media-paths");
async function probeAudioFile(filePath) {
    return new Promise((resolve) => {
        const proc = (0, child_process_1.spawn)('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            filePath,
        ]);
        let stdout = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.on('error', () => resolve(null));
        proc.on('close', (code) => {
            if (code !== 0) {
                resolve(null);
                return;
            }
            const duration = Number.parseFloat(stdout.trim());
            resolve(Number.isFinite(duration) && duration > 1 ? duration : null);
        });
    });
}
async function isPlayableAudioFile(filePath) {
    if (!fs_1.default.existsSync(filePath)) {
        return false;
    }
    const stats = fs_1.default.statSync(filePath);
    if (stats.size <= 1024) {
        return false;
    }
    return (await probeAudioFile(filePath)) !== null;
}
async function searchYouTube(query) {
    return new Promise((resolve, reject) => {
        const args = [
            `ytsearch1:${query}`,
            '--get-id',
            '--no-playlist',
        ];
        const proc = (0, child_process_1.spawn)('yt-dlp', args);
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('close', (code) => {
            const id = stdout.trim();
            resolve(id || null);
        });
        proc.on('error', (err) => {
            reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
        });
    });
}
async function downloadYouTube(youtubeId) {
    const outputPath = path_1.default.join(media_paths_1.AUDIO_DIR, `${youtubeId}.mp3`);
    if (await isPlayableAudioFile(outputPath)) {
        return outputPath;
    }
    if (fs_1.default.existsSync(outputPath)) {
        fs_1.default.rmSync(outputPath, { force: true });
    }
    fs_1.default.mkdirSync(media_paths_1.AUDIO_DIR, { recursive: true });
    return new Promise((resolve, reject) => {
        const args = [
            '-x',
            '--audio-format', 'mp3',
            '--audio-quality', '0',
            '-o', outputPath,
            '--force-overwrites',
            '--no-playlist',
            '--no-part',
            '--no-warnings',
            `https://www.youtube.com/watch?v=${youtubeId}`,
        ];
        const proc = (0, child_process_1.spawn)('yt-dlp', args);
        let stderr = '';
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`yt-dlp download failed (exit ${code}): ${stderr.slice(-500)}`));
                return;
            }
            isPlayableAudioFile(outputPath)
                .then((isPlayable) => {
                if (isPlayable) {
                    resolve(outputPath);
                    return;
                }
                if (fs_1.default.existsSync(outputPath)) {
                    fs_1.default.rmSync(outputPath, { force: true });
                }
                reject(new Error(`yt-dlp produced an invalid audio file for ${youtubeId}`));
            })
                .catch((error) => {
                reject(new Error(`Failed to validate downloaded audio: ${error.message}`));
            });
        });
        proc.on('error', (err) => {
            reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
        });
    });
}
//# sourceMappingURL=ytdlp.js.map