import { AiTool } from './ai-tool.type';

export interface AiToolResult {
  tool: AiTool;
  model: string;
  text?: string;
  targetLanguage?: string;
  rewriteGoal?: string;
  suggestions?: string[];
  hashtags?: string[];
}
