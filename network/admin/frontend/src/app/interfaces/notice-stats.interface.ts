export interface NoticeStats {
    total: number;
    open: number;
    byStatus: Record<string, number>;
}