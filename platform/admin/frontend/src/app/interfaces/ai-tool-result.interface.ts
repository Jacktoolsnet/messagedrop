import { AiTool } from './ai-tool.type';
import { Multimedia } from './multimedia.interface';

export interface AiQualityCheckResult {
  verdict: string;
  summary: string;
  strengths: string[];
  risks: string[];
  recommendations: string[];
  improvedText: string;
}

export interface AiContentCreatorSuggestion {
  message: string;
  hashtags: string[];
  locationQuery: string;
  multimedia: Multimedia | null;
  tenorQuery: string;
}

export interface AiToolResult {
  tool: AiTool;
  model: string;
  text?: string;
  targetLanguage?: string;
  rewriteGoal?: string;
  suggestions?: string[];
  hashtags?: string[];
  emojiSuggestions?: string[];
  qualityCheck?: AiQualityCheckResult | null;
  contentSuggestions?: AiContentCreatorSuggestion[] | null;
}
