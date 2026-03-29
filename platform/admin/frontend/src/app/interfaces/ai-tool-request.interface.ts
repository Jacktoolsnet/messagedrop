import { AiTool } from './ai-tool.type';
import { PublicContentType } from './public-content-type.type';

export interface AiToolRequest {
  tool: AiTool;
  text: string;
  prompt?: string;
  contentType: PublicContentType;
  locationLabel: string;
  publicProfileName: string;
  publicProfileGuidance?: string;
  parentLabel: string;
  existingHashtags: string[];
  contentUrls?: string[];
  multimediaUrl?: string;
  targetLanguage?: string;
  responseLanguage?: string;
  rewriteGoal?: string;
  creatorStyle?: string;
  creatorMessageType?: string;
  creatorHashtagStyle?: string;
  hashtagCount?: number;
  suggestionCount?: number;
  multimedia: {
    type: string;
    title: string;
    description: string;
  };
}
