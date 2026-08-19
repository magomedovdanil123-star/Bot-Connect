import type { AudioAsset, AudioSearchInput } from "./types";

export interface SFXProvider {
  readonly name: string;
  search(input: AudioSearchInput): Promise<AudioAsset[]>;
  getEffect(id: string): Promise<AudioAsset>;
  getPreview(id: string): Promise<string | null>;
  download(asset: AudioAsset): Promise<Buffer>;
}
