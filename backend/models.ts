import { z } from 'zod';

export const ProcessRequestSchema = z.object({
  url: z.string().url().optional(),
  urls: z.array(z.string().url()).optional(),
  profile: z.string().optional(),
  reel_count: z.number().min(1).max(100).default(20),
  provider: z.enum(['gemini', 'deepgram', 'openai', 'assemblyai']).default('gemini'),
  language: z.string().nullable().optional(),
  diarize: z.boolean().default(true),
  webhook_url: z.string().url().optional(),
  api_key: z.string().optional(),
});

export type ProcessRequest = z.infer<typeof ProcessRequestSchema>;

export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  TRANSCRIBING = 'TRANSCRIBING',
  DONE = 'DONE',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
}

export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface Word {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string;
}

export interface JobResult {
  job_id: string;
  instagram_url: string;
  status: JobStatus;
  transcript?: string;
  segments?: Segment[];
  words?: Word[];
  detected_language?: string;
  owner_username?: string;
  owner_full_name?: string;
  caption?: string;
  hashtags?: string[];
  mentions?: string[];
  likes_count?: number;
  comments_count?: number;
  video_view_count?: number;
  video_play_count?: number;
  video_duration?: number;
  thumbnail_url?: string;
  posted_at?: string;
  audio_file?: string;
  video_url?: string;
  channel_url?: string;
  channel_thumbnail?: string;
  transcript_confidence?: number;
  processing_time?: number;
  error?: string;
  summary?: string;
  sentiment?: string;
  keywords?: string[];
}

export interface Job {
  id: string;
  type: 'single' | 'bulk' | 'profile';
  status: JobStatus;
  progress: number;
  results: JobResult[];
  created_at: Date;
  updated_at: Date;
  webhook_url?: string;
}
