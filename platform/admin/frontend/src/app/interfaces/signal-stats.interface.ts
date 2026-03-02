export interface SignalStats {
    total: number;
    last24h: number;
    byType: Record<string, number>;
}