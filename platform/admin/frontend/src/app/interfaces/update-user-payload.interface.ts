export interface UpdateUserPayload {
    username?: string;
    email?: string;
    password?: string;
    role?: 'moderator' | 'legal' | 'admin' | 'root'; // je nach deinem Modell
}
