import type { MusicConnector, CoverArtConnector, Track } from './types';
export declare class MusicBrainzMetadataConnector implements MusicConnector {
    name: string;
    resolve(query: string): Promise<Track | null>;
}
export declare class MusicBrainzCoverArtConnector implements CoverArtConnector {
    name: string;
    resolve(track: Track): Promise<string | null>;
}
//# sourceMappingURL=musicbrainz.d.ts.map