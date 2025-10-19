import { DsaStatusAppeal } from './dsa-status-appeal.interface';
import { DsaStatusAuditEntry } from './dsa-status-audit-entry.interface';
import { DsaStatusDecision } from './dsa-status-decision.interface';
import { DsaStatusEvidence } from './dsa-status-evidence.interface';
import { DsaStatusNotice } from './dsa-status-notice.interface';
import { DsaStatusSignal } from './dsa-status-signal.interface';

export interface DsaStatusResponse {
  entityType: 'notice' | 'signal';
  notice?: DsaStatusNotice;
  signal?: DsaStatusSignal;
  decision?: DsaStatusDecision | null;
  evidence?: DsaStatusEvidence[];
  appeals?: DsaStatusAppeal[];
  audit: DsaStatusAuditEntry[];
}
