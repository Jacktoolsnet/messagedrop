export interface UpdateUserPayload {
    username?: string;
    email?: string;
    password?: string;
    role?: 'author' | 'editor' | 'moderator' | 'legal' | 'admin' | 'root';
}
