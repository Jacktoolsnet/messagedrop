import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PublicStatusAuditEntry {
  id: string;
  action: string;
  actor: string;
  createdAt: number;
  details?: unknown;
}

export interface PublicStatusEvidence {
  id: string;
  type: string;
  url?: string | null;
  hash?: string | null;
  fileName?: string | null;
  addedAt: number;
}

export interface PublicStatusDecision {
  id: string;
  noticeId: string;
  outcome: string;
  legalBasis?: string | null;
  tosBasis?: string | null;
  automatedUsed?: number;
  decidedBy?: string | null;
  decidedAt: number;
  statement?: string | null;
}

export interface PublicStatusAppeal {
  id: string;
  filedBy: string;
  filedAt: number;
  arguments: string;
  outcome?: string | null;
  resolvedAt?: number | null;
  reviewer?: string | null;
}

export interface PublicStatusNotice {
  id: string;
  contentId: string;
  contentUrl?: string | null;
  category?: string | null;
  reasonText?: string | null;
  reporterEmail?: string | null;
  reporterName?: string | null;
  truthAffirmation?: number | null;
  reportedContentType: string;
  reportedContent: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface PublicStatusSignal {
  id: string;
  contentId: string;
  contentUrl?: string | null;
  category?: string | null;
  reasonText?: string | null;
  reportedContentType: string;
  reportedContent: string;
  createdAt: number;
}

export interface PublicStatusResponse {
  entityType: 'notice' | 'signal';
  notice?: PublicStatusNotice;
  signal?: PublicStatusSignal;
  decision?: PublicStatusDecision | null;
  evidence?: PublicStatusEvidence[];
  appeals?: PublicStatusAppeal[];
  audit: PublicStatusAuditEntry[];
}

@Injectable({ providedIn: 'root' })
export class PublicStatusService {
  private readonly baseUrl = `${environment.apiUrl}/public/status`;
  private readonly http = inject(HttpClient);

  getStatus(token: string): Observable<PublicStatusResponse> {
    return this.http.get<PublicStatusResponse>(`${this.baseUrl}/${encodeURIComponent(token)}`);
  }

  downloadEvidence(token: string, evidenceId: string) {
    return this.http.get(`${this.baseUrl}/${encodeURIComponent(token)}/evidence/${encodeURIComponent(evidenceId)}`, {
      observe: 'response',
      responseType: 'blob'
    });
  }
}
