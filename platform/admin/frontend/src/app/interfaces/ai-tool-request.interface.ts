import { AiTool } from './ai-tool.type';
import { PublicContentType } from './public-content-type.type';

export interface AiToolRequest {
  tool: AiTool;
  text: string;
  contentType: PublicContentType;
  locationLabel: string;
  publicProfileName: string;
  parentLabel: string;
  existingHashtags: string[];
  targetLanguage?: string;
  rewriteGoal?: string;
  hashtagCount?: number;
  multimedia: {
    type: string;
    title: string;
    description: string;
  };
}
