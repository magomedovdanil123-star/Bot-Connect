import type { AudioAsset, AudioSearchInput } from "./types";

export interface MusicProvider {
  readonly name: string;
  search(input: AudioSearchInput): Promise<AudioAsset[]>;
  getTrack(id: string): Promise<AudioAsset>;
  getPreview(id: string): Promise<string | null>;
  download(asset: AudioAsset): Promise<Buffer>;
}
