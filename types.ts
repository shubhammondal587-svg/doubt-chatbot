
export type Role = 'user' | 'model';

export interface ChatMessage {
  role: Role;
  text: string;
  image?: string; // base64
  sources?: GroundingSource[];
}

export interface GroundingSource {
    uri: string;
    title: string;
}

export type Feature = 'live' | 'image-gen' | 'summaries' | 'learning-path';

export interface SessionSummary {
    id: string;
    title: string;
    content: string;
    date: string;
}
