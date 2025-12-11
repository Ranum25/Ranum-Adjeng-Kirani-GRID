export interface ImageResult {
  id: string;
  data: string; // Base64 string
  mimeType: string;
  prompt: string;
  model: string;
  timestamp: number;
}

export enum GenerationMode {
  GENERATE = 'GENERATE',
  EDIT_ANGLES = 'EDIT_ANGLES',
}

export enum ImageSize {
  SIZE_1K = '1K',
  SIZE_2K = '2K',
  SIZE_4K = '4K',
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '16:9' | '9:16';
