export interface LoginOtpResponse {
    status: 'otp_required';
    challengeId: string;
    expiresAt: number;
}
