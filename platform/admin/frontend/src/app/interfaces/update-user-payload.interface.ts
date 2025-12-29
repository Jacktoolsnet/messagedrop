export interface UpdateUserPayload {
    username?: string;
    password?: string;
    role?: 'moderator' | 'legal' | 'admin' | 'root'; // je nach deinem Modell
}
