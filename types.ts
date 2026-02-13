
export interface VisualMetadata {
  colors: string[];
  mood: string;
  setting: string;
  actions: string[];
  objects: string[];
  sceneType: string;
}

export interface Metrics {
  bleu: number;
  meteor: number;
  cider: number;
}

export interface AnalysisResult {
  primaryCaption: string;
  variants: string[];
  narrative: string;
  metadata: VisualMetadata;
  metrics: Metrics;
}

export type InputMode = 'upload' | 'camera' | 'video' | 'live';

export interface VisualInput {
  type: 'image' | 'video_frames';
  data: string | string[]; // Base64 strings
}

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' }
];
