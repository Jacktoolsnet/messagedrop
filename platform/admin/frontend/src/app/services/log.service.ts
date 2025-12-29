import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { ErrorLogEntry } from '../interfaces/error-log-entry';
import { FrontendErrorLogEntry } from '../interfaces/frontend-error-log-entry';
import { PowLogEntry } from '../interfaces/pow-log-entry';

export interface LogCountResponse {
    count: number;
    since: number;
}

@Injectable({ providedIn: 'root' })
export class LogService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = environment.apiUrl;

    getErrorCountSince(since: number) {
        return this.http.get<LogCountResponse>(`${this.baseUrl}/error-log/count?since=${since}`)
            .pipe(catchError(() => of({ count: 0, since })));
    }

    getInfoCountSince(since: number) {
        return this.http.get<LogCountResponse>(`${this.baseUrl}/info-log/count?since=${since}`)
            .pipe(catchError(() => of({ count: 0, since })));
    }

    getFrontendErrorCountSince(since: number) {
        return this.http.get<LogCountResponse>(`${this.baseUrl}/frontend-error-log/count?since=${since}`)
            .pipe(catchError(() => of({ count: 0, since })));
    }

    getPowCountSince(since: number) {
        return this.http.get<LogCountResponse>(`${this.baseUrl}/pow-log/count?since=${since}`)
            .pipe(catchError(() => of({ count: 0, since })));
    }

    listErrorLogs(limit = 100, offset = 0) {
        return this.http.get<{ rows: ErrorLogEntry[] }>(`${this.baseUrl}/error-log?limit=${limit}&offset=${offset}`)
            .pipe(catchError(() => of({ rows: [] })));
    }

    deleteErrorLog(id: string) {
        return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/error-log/${id}`)
            .pipe(catchError(() => of({ deleted: false })));
    }

    listInfoLogs(limit = 100, offset = 0) {
        return this.http.get<{ rows: ErrorLogEntry[] }>(`${this.baseUrl}/info-log?limit=${limit}&offset=${offset}`)
            .pipe(catchError(() => of({ rows: [] })));
    }

    deleteInfoLog(id: string) {
        return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/info-log/${id}`)
            .pipe(catchError(() => of({ deleted: false })));
    }

    deleteAllInfoLogs() {
        return this.http.delete<{ deleted: boolean; count?: number }>(`${this.baseUrl}/info-log`)
            .pipe(catchError(() => of({ deleted: false, count: 0 })));
    }

    listFrontendErrorLogs(limit = 100, offset = 0) {
        return this.http.get<{ rows: FrontendErrorLogEntry[] }>(`${this.baseUrl}/frontend-error-log?limit=${limit}&offset=${offset}`)
            .pipe(catchError(() => of({ rows: [] })));
    }

    deleteFrontendErrorLog(id: string) {
        return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/frontend-error-log/${id}`)
            .pipe(catchError(() => of({ deleted: false })));
    }

    listPowLogs(limit = 100, offset = 0) {
        return this.http.get<{ rows: PowLogEntry[] }>(`${this.baseUrl}/pow-log?limit=${limit}&offset=${offset}`)
            .pipe(catchError(() => of({ rows: [] })));
    }

    deletePowLog(id: string) {
        return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/pow-log/${id}`)
            .pipe(catchError(() => of({ deleted: false })));
    }
}
