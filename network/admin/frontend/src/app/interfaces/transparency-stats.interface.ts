export interface TransparencyCategoryEntry {
  category: string;
  count: number;
}

export interface TransparencyTrendEntry {
  month: string; // YYYY-MM
  notices: number;
  decisions: number;
}

export interface TransparencyStats {
  range: {
    from: number | null;
    to: number;
    label: string;
  };
  notices: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    topCategories: TransparencyCategoryEntry[];
  };
  decisions: {
    total: number;
    byOutcome: Record<string, number>;
    avgDecisionTimeMs: number;
    automated: {
      automated: number;
      manual: number;
    };
  };
  signals: {
    total: number;
    byType: Record<string, number>;
    topCategories: TransparencyCategoryEntry[];
  };
  trend: TransparencyTrendEntry[];
}
