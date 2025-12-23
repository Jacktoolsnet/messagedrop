import { UserServerBackup } from './backup';

export interface GetUserBackupResponse {
  status: number;
  backup: UserServerBackup;
}
