export interface AiUsageWindow {
  startTime: number;
  endTime: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  requests: number;
  totalTokens: number;
  spend: {
    value: number;
    currency: string;
  };
}

export interface AiUsage {
  usageAvailable: boolean;
  costsAvailable: boolean;
  requiresAdminKey: boolean;
  keySource: 'admin' | 'standard' | 'none' | string;
  budgetConfigured: boolean;
  monthlyBudgetUsd: number;
  remainingBudgetUsd: number | null;
  currency: string;
  today: AiUsageWindow;
  last7Days: AiUsageWindow;
  currentMonth: AiUsageWindow;
  updatedAt: number;
  message: string;
}
