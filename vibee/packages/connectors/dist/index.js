"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeThumbnailConnector = exports.ItunesCoverArtConnector = exports.LastFmConnector = exports.MusicBrainzCoverArtConnector = exports.MusicBrainzMetadataConnector = exports.YouTubeConnector = void 0;
// Connectors (imported as they are implemented in subsequent stories)
var youtube_1 = require("./youtube"); // story 4.2
Object.defineProperty(exports, "YouTubeConnector", { enumerable: true, get: function () { return youtube_1.YouTubeConnector; } });
var musicbrainz_1 = require("./musicbrainz"); // story 4.3
Object.defineProperty(exports, "MusicBrainzMetadataConnector", { enumerable: true, get: function () { return musicbrainz_1.MusicBrainzMetadataConnector; } });
Object.defineProperty(exports, "MusicBrainzCoverArtConnector", { enumerable: true, get: function () { return musicbrainz_1.MusicBrainzCoverArtConnector; } });
var lastfm_1 = require("./lastfm"); // story 4.4
Object.defineProperty(exports, "LastFmConnector", { enumerable: true, get: function () { return lastfm_1.LastFmConnector; } });
var cover_art_1 = require("./cover-art"); // story 4.5
Object.defineProperty(exports, "ItunesCoverArtConnector", { enumerable: true, get: function () { return cover_art_1.ItunesCoverArtConnector; } });
Object.defineProperty(exports, "YouTubeThumbnailConnector", { enumerable: true, get: function () { return cover_art_1.YouTubeThumbnailConnector; } });
//# sourceMappingURL=index.js.map