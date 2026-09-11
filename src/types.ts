export type ArticleTone =
  | "thought-leadership"
  | "technical-deep-dive"
  | "founder-story"
  | "industry-analysis"
  | "how-to-guide";

export type ImageStyle =
  | "editorial-minimal"
  | "abstract-geometric"
  | "cyberpunk-future"
  | "architectural";

export interface ArticleFormData {
  topic: string;
  targetAudience: string;
  tone: ArticleTone;
  keyPoints: string;
  targetWordCount: number;
  model: string;
  voice: string;
  imageStyle: ImageStyle;
  imageModel: string;
}

export interface ArticleResult {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  coverImageUrl: string;
  isGeneratingImage: boolean;
  imageError?: string | null;
  imageModel: string;
  audioUrl: string | null;
  isGeneratingAudio: boolean;
  audioError?: string | null;
  readingTimeMinutes: number;
  wordCount: number;
  createdAt: string;
  topic: string;
  tone: ArticleTone;
  model: string;
  voice: string;
}

export type AgentStep =
  | "idle"
  | "drafting_article"
  | "generating_image"
  | "synthesizing_audio"
  | "completed"
  | "error";

export interface AgentProgress {
  step: AgentStep;
  message: string;
  error?: string;
}
