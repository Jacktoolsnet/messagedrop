import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { ErrorLogEntry } from '../interfaces/error-log-entry';

export interface LogCountResponse {
    count: number;
    since: number;
}

@Injectable({ providedIn: 'root' })
export class LogService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = environment.apiUrl;
    private readonly httpOptions = {
        headers: new HttpHeaders({
            'Content-Type': 'application/json',
            'X-API-Authorization': `${environment.apiToken}`
        })
    };

    getErrorCountSince(since: number) {
        return this.http.get<LogCountResponse>(`${this.baseUrl}/error-log/count?since=${since}`, this.httpOptions)
            .pipe(catchError(() => of({ count: 0, since })));
    }

    getInfoCountSince(since: number) {
        return this.http.get<LogCountResponse>(`${this.baseUrl}/info-log/count?since=${since}`, this.httpOptions)
            .pipe(catchError(() => of({ count: 0, since })));
    }

    listErrorLogs(limit = 100, offset = 0) {
        return this.http.get<{ rows: ErrorLogEntry[] }>(`${this.baseUrl}/error-log?limit=${limit}&offset=${offset}`, this.httpOptions)
            .pipe(catchError(() => of({ rows: [] })));
    }

    deleteErrorLog(id: string) {
        return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/error-log/${id}`, this.httpOptions)
            .pipe(catchError(() => of({ deleted: false })));
    }

    listInfoLogs(limit = 100, offset = 0) {
        return this.http.get<{ rows: ErrorLogEntry[] }>(`${this.baseUrl}/info-log?limit=${limit}&offset=${offset}`, this.httpOptions)
            .pipe(catchError(() => of({ rows: [] })));
    }

    deleteInfoLog(id: string) {
        return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/info-log/${id}`, this.httpOptions)
            .pipe(catchError(() => of({ deleted: false })));
    }
}
