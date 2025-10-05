export interface UpdateUserPayload {
    username?: string;
    password?: string;
    role?: 'moderator' | 'admin' | 'root'; // je nach deinem Modell
}