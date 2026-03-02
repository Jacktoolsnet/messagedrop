import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { ModerationRequest } from '../interfaces/moderation-request.interface';

@Injectable({ providedIn: 'root' })
export class ModerationService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = environment.apiUrl;

    listRequests(status = 'pending', limit = 200, offset = 0) {
        return this.http.get<{ rows: ModerationRequest[] }>(
            `${this.baseUrl}/moderation/requests?status=${encodeURIComponent(status)}&limit=${limit}&offset=${offset}`
        ).pipe(catchError(() => of({ rows: [] })));
    }

    countRequests(status = 'pending') {
        return this.http.get<{ count: number }>(
            `${this.baseUrl}/moderation/requests/count?status=${encodeURIComponent(status)}`
        ).pipe(catchError(() => of({ count: 0 })));
    }

    approveRequest(id: string) {
        return this.http.post<{ approved: boolean }>(`${this.baseUrl}/moderation/requests/${id}/approve`, {})
            .pipe(catchError(() => of({ approved: false })));
    }

    rejectRequest(id: string, reason: string) {
        return this.http.post<{ rejected: boolean }>(`${this.baseUrl}/moderation/requests/${id}/reject`, { reason })
            .pipe(catchError(() => of({ rejected: false })));
    }
}
