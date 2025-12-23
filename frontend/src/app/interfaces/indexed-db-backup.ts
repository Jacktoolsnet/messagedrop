export interface IndexedDbBackupEntry {
  key: IDBValidKey;
  value: unknown;
}

export interface IndexedDbBackup {
  dbName: string;
  dbVersion: number;
  stores: Record<string, IndexedDbBackupEntry[]>;
  skippedStores?: string[];
}
