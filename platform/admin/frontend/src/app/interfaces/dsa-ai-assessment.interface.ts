export type DsaAiAssessmentEntityType = 'signal' | 'notice';
export type DsaAiRiskLevel = 'low' | 'medium' | 'high';
export type DsaAiIllegalityLikelihood = 'low' | 'medium' | 'high' | 'unclear';
export type DsaAiWorkflowRecommendation =
  | 'dismiss_signal'
  | 'request_more_evidence'
  | 'promote_to_notice'
  | 'keep_under_review'
  | 'no_action'
  | 'restrict_content'
  | 'remove_content'
  | 'forward_to_legal_review'
  | 'forward_to_authority';

export type DsaAiSuggestedDecisionOutcome =
  | 'UNDECIDED'
  | 'NO_ACTION'
  | 'RESTRICT'
  | 'REMOVE_CONTENT'
  | 'FORWARD_TO_AUTHORITY';

export interface DsaAiAssessmentClauseMatch {
  key: string;
  labelDe: string;
  labelEn: string;
  confidence: number | null;
  reasonDe: string;
  reasonEn: string;
}

export interface DsaAiAssessmentResult {
  riskLevel: DsaAiRiskLevel;
  illegalityLikelihood: DsaAiIllegalityLikelihood;
  workflowRecommendation: DsaAiWorkflowRecommendation;
  suggestedDecisionOutcome: DsaAiSuggestedDecisionOutcome;
  summaryDe: string;
  summaryEn: string;
  actionJustificationDe: string;
  actionJustificationEn: string;
  tosMatches: DsaAiAssessmentClauseMatch[];
  observedSignalsDe: string[];
  observedSignalsEn: string[];
  evidenceGapsDe: string[];
  evidenceGapsEn: string[];
  uncertaintiesDe: string[];
  uncertaintiesEn: string[];
  recommendedNextStepsDe: string[];
  recommendedNextStepsEn: string[];
}

export interface DsaAiAssessmentRecord {
  id: string;
  entityType: DsaAiAssessmentEntityType;
  entityId: string;
  createdAt: number;
  createdBy: string;
  model: string;
  tosVersion: string;
  tosHash: string;
  result: DsaAiAssessmentResult;
}
