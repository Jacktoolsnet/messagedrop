export interface User {
    id: string;
    username: string;
    email: string;
    role: string;
    publicBackendUserId?: string | null;
    createdAt: number;
}
