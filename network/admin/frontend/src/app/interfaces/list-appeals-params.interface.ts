export interface ListAppealsParams {
    status?: 'open' | 'resolved' | 'all';
    noticeId?: string;
    outcome?: string;
    limit?: number;
    offset?: number;
}
