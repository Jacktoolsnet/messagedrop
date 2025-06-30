import { User } from "./user";

export interface ConfirmUserResponse {
    status: number,
    user: User
    jwt: string
}

