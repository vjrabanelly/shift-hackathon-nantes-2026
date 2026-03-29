"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSITIONS_DIR = exports.HLS_ROOT_DIR = exports.AUDIO_DIR = exports.MEDIA_ROOT = void 0;
exports.getEventStreamDir = getEventStreamDir;
exports.getEventPlaylistPath = getEventPlaylistPath;
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
exports.MEDIA_ROOT = process.env.PARTYJAM_MEDIA_ROOT ?? node_path_1.default.join(node_os_1.default.tmpdir(), 'partyjam');
exports.AUDIO_DIR = node_path_1.default.join(exports.MEDIA_ROOT, 'audio');
exports.HLS_ROOT_DIR = node_path_1.default.join(exports.MEDIA_ROOT, 'hls');
exports.TRANSITIONS_DIR = node_path_1.default.join(exports.MEDIA_ROOT, 'transitions');
function getEventStreamDir(eventId) {
    return node_path_1.default.join(exports.HLS_ROOT_DIR, eventId);
}
function getEventPlaylistPath(eventId) {
    return node_path_1.default.join(getEventStreamDir(eventId), 'playlist.m3u8');
}
//# sourceMappingURL=media-paths.js.map