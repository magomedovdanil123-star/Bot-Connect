export type ImageGenerationSettings = {
  aspectRatio: string;
  visualStyle: string;
  realism: string;
  people: string;
  colorAtmosphere: string;
  characterDescription?: string;
};

export type GeneratedImageAsset = {
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
};

export interface ImageProvider {
  readonly name: string;
  readonly model: string;
  generate(prompt: string, settings: ImageGenerationSettings): Promise<GeneratedImageAsset>;
}