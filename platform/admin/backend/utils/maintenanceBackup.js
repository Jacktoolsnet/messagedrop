const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const BACKUP_ROOT = path.join(REPO_ROOT, 'backups');
const LATEST_METADATA_FILE = path.join(BACKUP_ROOT, 'latest.json');
const PENDING_RESTORE_FILE = path.join(BACKUP_ROOT, 'pending-restore.json');
const LAST_RESTORE_FILE = path.join(BACKUP_ROOT, 'last-restore.json');
const BACKUP_PREFIX = 'messagedrop-backup-';
const BACKUP_SUFFIX = '.zip';
const BACKUP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const DATABASE_DEFINITIONS = [
  {
    key: 'public-backend',
    label: 'Public backend',
    relativeSourcePath: 'backend/db/messagedrop.db',
    fileName: 'messagedrop.db'
  },
  {
    key: 'admin-backend',
    label: 'Admin backend',
    relativeSourcePath: 'platform/admin/backend/db/messagedropAdmin.db',
    fileName: 'messagedropAdmin.db'
  },
  {
    key: 'openmeteo-service',
    label: 'OpenMeteo service',
    relativeSourcePath: 'services/openMeteo/db/openMeteo.db',
    fileName: 'openMeteo.db'
  },
  {
    key: 'nominatim-service',
    label: 'Nominatim service',
    relativeSourcePath: 'services/nominatim/db/nominatim.db',
    fileName: 'nominatim.db'
  },
  {
    key: 'viator-service',
    label: 'Viator service',
    relativeSourcePath: 'services/viator/db/viator.db',
    fileName: 'viator.db'
  }
];

function normalizeTimestamp(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeMaintenanceSnapshot(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    enabled: Boolean(source.enabled),
    startsAt: normalizeTimestamp(source.startsAt),
    endsAt: normalizeTimestamp(source.endsAt),
    reason: normalizeText(source.reason),
    reasonEn: normalizeText(source.reasonEn),
    reasonEs: normalizeText(source.reasonEs),
    reasonFr: normalizeText(source.reasonFr),
    updatedAt: normalizeTimestamp(source.updatedAt)
  };
}

function getDatabaseSync() {
  const { DatabaseSync } = require('node:sqlite');
  return DatabaseSync;
}

function getAdmZip() {
  return require('adm-zip');
}

function buildBackupId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function buildDirectoryName(id) {
  return `${BACKUP_PREFIX}${id}`;
}

function buildArchiveName(id) {
  return `${buildDirectoryName(id)}${BACKUP_SUFFIX}`;
}

function escapeSqliteStringLiteral(value) {
  return String(value).replace(/'/g, "''");
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function statOrNull(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

async function removeIfExists(filePath) {
  await fs.rm(filePath, { recursive: true, force: true });
}

async function readJsonIfExists(filePath) {
  const stat = await statOrNull(filePath);
  if (!stat?.isFile()) {
    return null;
  }
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJson(filePath, payload) {
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function parseBackupIdFromArchiveName(archiveName) {
  if (typeof archiveName !== 'string') {
    return null;
  }
  const match = archiveName.match(/^messagedrop-backup-(.+)\.zip$/);
  const id = match?.[1] || null;
  if (!id || !BACKUP_ID_PATTERN.test(id)) {
    return null;
  }
  return id;
}

function normalizeBackupMetadata(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const id = typeof raw.id === 'string' && BACKUP_ID_PATTERN.test(raw.id) ? raw.id : null;
  const archiveName = typeof raw.archiveName === 'string' && raw.archiveName.trim()
    ? raw.archiveName.trim()
    : null;

  if (!id || !archiveName) {
    return null;
  }

  const createdAt = Number(raw.createdAt);
  const archiveSizeBytes = Number(raw.archiveSizeBytes);
  const directoryName = typeof raw.directoryName === 'string' && raw.directoryName.trim()
    ? raw.directoryName.trim()
    : buildDirectoryName(id);

  const databases = Array.isArray(raw.databases)
    ? raw.databases
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => {
        const sizeBytes = Number(entry.sizeBytes);
        return {
          key: typeof entry.key === 'string' ? entry.key : 'unknown',
          label: typeof entry.label === 'string' ? entry.label : 'Database',
          fileName: typeof entry.fileName === 'string' ? entry.fileName : 'database.db',
          relativeSourcePath: typeof entry.relativeSourcePath === 'string' ? entry.relativeSourcePath : null,
          sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0
        };
      })
    : [];
  const maintenanceSnapshot = normalizeMaintenanceSnapshot(raw.maintenanceSnapshot);

  return {
    id,
    createdAt: Number.isFinite(createdAt) ? createdAt : null,
    directoryName,
    archiveName,
    archiveSizeBytes: Number.isFinite(archiveSizeBytes) ? archiveSizeBytes : 0,
    databases,
    maintenanceSnapshot,
    downloadPath: `/maintenance/backup/${encodeURIComponent(id)}/download`
  };
}

function normalizeValidationResult(backup, issues = []) {
  const normalizedIssues = Array.isArray(issues)
    ? issues.filter((issue) => typeof issue === 'string' && issue.trim())
    : [];

  return {
    backup,
    valid: normalizedIssues.length === 0,
    issues: normalizedIssues
  };
}

function normalizePendingRestore(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const backupId = typeof raw.backupId === 'string' && BACKUP_ID_PATTERN.test(raw.backupId)
    ? raw.backupId
    : null;
  const archiveName = typeof raw.archiveName === 'string' && raw.archiveName.trim()
    ? raw.archiveName.trim()
    : backupId ? buildArchiveName(backupId) : null;
  if (!backupId || !archiveName) {
    return null;
  }

  const preparedAt = Number(raw.preparedAt);
  return {
    backupId,
    archiveName,
    directoryName: typeof raw.directoryName === 'string' && raw.directoryName.trim()
      ? raw.directoryName.trim()
      : buildDirectoryName(backupId),
    preparedAt: Number.isFinite(preparedAt) ? preparedAt : null,
    preparedBy: typeof raw.preparedBy === 'string' && raw.preparedBy.trim() ? raw.preparedBy.trim() : null,
    databases: Array.isArray(raw.databases) ? raw.databases : [],
    maintenanceSnapshot: normalizeMaintenanceSnapshot(raw.maintenanceSnapshot)
  };
}

function normalizeRestoreStatus(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const status = typeof raw.status === 'string' && raw.status.trim() ? raw.status.trim() : null;
  const backupId = typeof raw.backupId === 'string' && BACKUP_ID_PATTERN.test(raw.backupId)
    ? raw.backupId
    : null;
  if (!status || !backupId) {
    return null;
  }
  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };
  return {
    status,
    backupId,
    archiveName: typeof raw.archiveName === 'string' && raw.archiveName.trim()
      ? raw.archiveName.trim()
      : buildArchiveName(backupId),
    message: typeof raw.message === 'string' && raw.message.trim() ? raw.message.trim() : null,
    preparedAt: toNumber(raw.preparedAt),
    startedAt: toNumber(raw.startedAt),
    finishedAt: toNumber(raw.finishedAt),
    preparedBy: typeof raw.preparedBy === 'string' && raw.preparedBy.trim() ? raw.preparedBy.trim() : null,
    databases: Array.isArray(raw.databases) ? raw.databases : [],
    maintenanceSnapshot: normalizeMaintenanceSnapshot(raw.maintenanceSnapshot)
  };
}

function openBackupZip(archivePath) {
  const AdmZip = getAdmZip();
  return new AdmZip(archivePath);
}

function findManifestEntry(zip) {
  return zip.getEntries().find((entry) => !entry.isDirectory && /(^|\/)manifest\.json$/i.test(entry.entryName));
}

function readBackupMetadataFromArchiveSync(archivePath, archiveStat = null) {
  const zip = openBackupZip(archivePath);
  const manifestEntry = findManifestEntry(zip);
  if (!manifestEntry) {
    return normalizeValidationResult(null, ['Manifest is missing in the backup archive.']);
  }

  let manifest;
  try {
    manifest = JSON.parse(zip.readAsText(manifestEntry, 'utf8'));
  } catch {
    return normalizeValidationResult(null, ['Manifest could not be parsed.']);
  }

  const archiveName = path.basename(archivePath);
  const backupId = parseBackupIdFromArchiveName(archiveName) || manifest?.id || null;
  const metadata = normalizeBackupMetadata({
    ...manifest,
    id: backupId,
    archiveName,
    archiveSizeBytes: Number(archiveStat?.size || 0)
  });

  if (!metadata) {
    return normalizeValidationResult(null, ['Manifest metadata is incomplete.']);
  }

  const issues = [];
  const entries = zip.getEntries();

  for (const definition of DATABASE_DEFINITIONS) {
    const databaseEntry = metadata.databases.find((item) => item.key === definition.key);
    if (!databaseEntry) {
      issues.push(`Manifest entry for ${definition.label} is missing.`);
      continue;
    }

    const hasZipEntry = entries.some((entry) => !entry.isDirectory && (
      entry.entryName === `${metadata.directoryName}/${definition.fileName}` ||
      entry.entryName.endsWith(`/${definition.fileName}`)
    ));

    if (!hasZipEntry) {
      issues.push(`${definition.fileName} is missing in the ZIP archive.`);
    }
  }

  if (metadata.databases.length !== DATABASE_DEFINITIONS.length) {
    issues.push('The manifest does not contain the expected number of databases.');
  }

  return normalizeValidationResult(metadata, issues);
}

async function createSqliteSnapshot(sourcePath, targetPath) {
  const DatabaseSync = getDatabaseSync();
  const db = new DatabaseSync(sourcePath);
  try {
    db.exec('PRAGMA busy_timeout = 10000;');
    db.exec(`VACUUM INTO '${escapeSqliteStringLiteral(targetPath)}';`);
  } finally {
    db.close();
  }
}

async function zipDirectory(sourceDir, archivePath) {
  const AdmZip = getAdmZip();
  const zip = new AdmZip();
  zip.addLocalFolder(sourceDir, path.basename(sourceDir));
  zip.writeZip(archivePath);
}

async function createBackup(options = {}) {
  const logger = options.logger ?? console;
  const maintenanceSnapshot = normalizeMaintenanceSnapshot(options.maintenanceSnapshot);

  await ensureDirectory(BACKUP_ROOT);

  const createdAt = Date.now();
  const id = buildBackupId(new Date(createdAt));
  const directoryName = buildDirectoryName(id);
  const backupDir = path.join(BACKUP_ROOT, directoryName);
  const archiveName = buildArchiveName(id);
  const archivePath = path.join(BACKUP_ROOT, archiveName);

  await fs.mkdir(backupDir, { recursive: false });
  await removeIfExists(archivePath);

  try {
    const databases = [];
    for (const definition of DATABASE_DEFINITIONS) {
      const sourcePath = path.join(REPO_ROOT, definition.relativeSourcePath);
      const sourceStat = await statOrNull(sourcePath);
      if (!sourceStat?.isFile()) {
        throw new Error(`database_source_missing:${definition.relativeSourcePath}`);
      }

      const snapshotPath = path.join(backupDir, definition.fileName);
      await removeIfExists(snapshotPath);
      await createSqliteSnapshot(sourcePath, snapshotPath);
      const snapshotStat = await fs.stat(snapshotPath);

      databases.push({
        key: definition.key,
        label: definition.label,
        fileName: definition.fileName,
        relativeSourcePath: definition.relativeSourcePath,
        sizeBytes: snapshotStat.size
      });
    }

    const manifest = {
      id,
      createdAt,
      directoryName,
      archiveName,
      databases,
      maintenanceSnapshot
    };

    await fs.writeFile(
      path.join(backupDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    await zipDirectory(backupDir, archivePath);
    const archiveStat = await fs.stat(archivePath);

    const metadata = normalizeBackupMetadata({
      ...manifest,
      archiveSizeBytes: archiveStat.size
    });

    if (!metadata) {
      throw new Error('backup_metadata_invalid');
    }

    await writeJson(LATEST_METADATA_FILE, metadata);
    logger?.info?.('Maintenance backup created', {
      backupId: metadata.id,
      archiveName: metadata.archiveName,
      archiveSizeBytes: metadata.archiveSizeBytes,
      databases: metadata.databases.map((entry) => ({
        key: entry.key,
        sizeBytes: entry.sizeBytes
      }))
    });
    return metadata;
  } catch (error) {
    logger?.error?.('Maintenance backup failed', { error: error?.message || error });
    await removeIfExists(backupDir).catch(() => {});
    await removeIfExists(archivePath).catch(() => {});
    throw error;
  }
}

async function getLatestBackup() {
  const parsed = await readJsonIfExists(LATEST_METADATA_FILE);
  const metadata = normalizeBackupMetadata(parsed);
  if (!metadata) {
    return null;
  }
  const archivePath = resolveBackupArchivePath(metadata.id);
  const archiveStat = await statOrNull(archivePath);
  if (!archiveStat?.isFile()) {
    return null;
  }
  if (!metadata.archiveSizeBytes) {
    metadata.archiveSizeBytes = archiveStat.size;
  }
  return metadata;
}

function resolveBackupArchivePath(backupId) {
  if (typeof backupId !== 'string' || !BACKUP_ID_PATTERN.test(backupId)) {
    throw new Error('invalid_backup_id');
  }
  return path.join(BACKUP_ROOT, buildArchiveName(backupId));
}

async function validateBackup(backupId) {
  const archivePath = resolveBackupArchivePath(backupId);
  const archiveStat = await statOrNull(archivePath);
  if (!archiveStat?.isFile()) {
    return normalizeValidationResult(null, ['Backup archive does not exist.']);
  }
  return readBackupMetadataFromArchiveSync(archivePath, archiveStat);
}

async function listBackups() {
  await ensureDirectory(BACKUP_ROOT);
  const entries = await fs.readdir(BACKUP_ROOT, { withFileTypes: true });
  const backups = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(BACKUP_SUFFIX)) {
      continue;
    }
    const id = parseBackupIdFromArchiveName(entry.name);
    if (!id) {
      continue;
    }
    const validation = await validateBackup(id);
    if (!validation.backup) {
      continue;
    }
    backups.push({
      ...validation.backup,
      valid: validation.valid,
      issues: validation.issues
    });
  }

  backups.sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));
  return backups;
}

async function prepareRestore(backupId, options = {}) {
  const validation = await validateBackup(backupId);
  if (!validation.valid || !validation.backup) {
    const error = new Error('backup_invalid');
    error.issues = validation.issues;
    throw error;
  }

  const preparedAt = Date.now();
  const pendingRestore = normalizePendingRestore({
    backupId: validation.backup.id,
    archiveName: validation.backup.archiveName,
    directoryName: validation.backup.directoryName,
    preparedAt,
    preparedBy: options.preparedBy ?? null,
    databases: validation.backup.databases,
    maintenanceSnapshot: validation.backup.maintenanceSnapshot
  });

  await writeJson(PENDING_RESTORE_FILE, pendingRestore);
  await writeJson(LAST_RESTORE_FILE, {
    status: 'pending',
    backupId: validation.backup.id,
    archiveName: validation.backup.archiveName,
    message: 'Restore prepared. Stop all Node.js apps in Plesk and start only the admin backend once.',
    preparedAt,
    preparedBy: options.preparedBy ?? null,
    databases: validation.backup.databases,
    maintenanceSnapshot: validation.backup.maintenanceSnapshot
  });

  return pendingRestore;
}

async function getPendingRestore() {
  const parsed = await readJsonIfExists(PENDING_RESTORE_FILE);
  return normalizePendingRestore(parsed);
}

async function getLastRestore() {
  const parsed = await readJsonIfExists(LAST_RESTORE_FILE);
  return normalizeRestoreStatus(parsed);
}

async function getRestoreStatus() {
  const [pendingRestore, lastRestore] = await Promise.all([
    getPendingRestore(),
    getLastRestore()
  ]);
  return { pendingRestore, lastRestore };
}

async function performPendingRestore(logger = console) {
  const pendingRestore = await getPendingRestore();
  if (!pendingRestore) {
    return null;
  }

  const startedAt = Date.now();
  await writeJson(LAST_RESTORE_FILE, {
    status: 'running',
    backupId: pendingRestore.backupId,
    archiveName: pendingRestore.archiveName,
    message: 'Restore started during admin backend startup.',
    preparedAt: pendingRestore.preparedAt,
    preparedBy: pendingRestore.preparedBy,
    startedAt,
    databases: pendingRestore.databases
  });

  const validation = await validateBackup(pendingRestore.backupId);
  if (!validation.valid || !validation.backup) {
    const message = validation.issues.join(' ') || 'Restore validation failed.';
    await removeIfExists(PENDING_RESTORE_FILE);
    await writeJson(LAST_RESTORE_FILE, {
      status: 'failed',
      backupId: pendingRestore.backupId,
      archiveName: pendingRestore.archiveName,
      message,
      preparedAt: pendingRestore.preparedAt,
      preparedBy: pendingRestore.preparedBy,
      startedAt,
      finishedAt: Date.now(),
      databases: pendingRestore.databases
    });
    throw new Error(message);
  }

  const restoreToken = crypto.randomBytes(4).toString('hex');
  const tempDir = path.join(BACKUP_ROOT, `.restore-${pendingRestore.backupId}-${restoreToken}`);
  const archivePath = resolveBackupArchivePath(pendingRestore.backupId);

  const restoreMaintenanceSnapshot = async (snapshot) => {
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }

    const targetDbPath = path.join(REPO_ROOT, 'backend/db/messagedrop.db');
    const DatabaseSync = getDatabaseSync();
    const db = new DatabaseSync(targetDbPath);
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS tableMaintenance (
          id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
          enabled INTEGER NOT NULL DEFAULT 0,
          startsAt INTEGER DEFAULT NULL,
          endsAt INTEGER DEFAULT NULL,
          reason TEXT DEFAULT NULL,
          reasonEn TEXT DEFAULT NULL,
          reasonEs TEXT DEFAULT NULL,
          reasonFr TEXT DEFAULT NULL,
          updatedAt INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO tableMaintenance (id, enabled, updatedAt)
        VALUES (1, 0, strftime('%s','now'));
      `);

      const stmt = db.prepare(`
        UPDATE tableMaintenance
        SET enabled = ?,
            startsAt = ?,
            endsAt = ?,
            reason = ?,
            reasonEn = ?,
            reasonEs = ?,
            reasonFr = ?,
            updatedAt = ?
        WHERE id = 1;
      `);
      stmt.run(
        snapshot.enabled ? 1 : 0,
        snapshot.startsAt ?? null,
        snapshot.endsAt ?? null,
        snapshot.reason ?? null,
        snapshot.reasonEn ?? null,
        snapshot.reasonEs ?? null,
        snapshot.reasonFr ?? null,
        snapshot.updatedAt ?? Math.floor(Date.now() / 1000)
      );
    } finally {
      db.close();
    }
  };

  try {
    await ensureDirectory(tempDir);
    const zip = openBackupZip(archivePath);
    zip.extractAllTo(tempDir, true);

    const extractedRootCandidate = path.join(tempDir, validation.backup.directoryName);
    const extractedRoot = (await statOrNull(extractedRootCandidate))?.isDirectory()
      ? extractedRootCandidate
      : tempDir;

    for (const definition of DATABASE_DEFINITIONS) {
      const sourceFile = path.join(extractedRoot, definition.fileName);
      const sourceStat = await statOrNull(sourceFile);
      if (!sourceStat?.isFile()) {
        throw new Error(`restore_source_missing:${definition.fileName}`);
      }
    }

    for (const definition of DATABASE_DEFINITIONS) {
      const targetFile = path.join(REPO_ROOT, definition.relativeSourcePath);
      const sourceFile = path.join(extractedRoot, definition.fileName);
      const temporaryTarget = `${targetFile}.restore-tmp`;

      await ensureDirectory(path.dirname(targetFile));
      await removeIfExists(temporaryTarget);
      await fs.copyFile(sourceFile, temporaryTarget);
      await removeIfExists(`${targetFile}-wal`);
      await removeIfExists(`${targetFile}-shm`);
      await removeIfExists(targetFile);
      await fs.rename(temporaryTarget, targetFile);
    }

    await restoreMaintenanceSnapshot(
      validation.backup.maintenanceSnapshot ?? pendingRestore.maintenanceSnapshot
    );

    const finishedAt = Date.now();
    const successState = {
      status: 'success',
      backupId: validation.backup.id,
      archiveName: validation.backup.archiveName,
      message: 'Restore completed successfully. You can now start the remaining Node.js apps in Plesk.',
      preparedAt: pendingRestore.preparedAt,
      preparedBy: pendingRestore.preparedBy,
      startedAt,
      finishedAt,
      databases: validation.backup.databases
    };
    await removeIfExists(PENDING_RESTORE_FILE);
    await writeJson(LAST_RESTORE_FILE, successState);
    logger?.info?.('Pending restore completed', {
      backupId: validation.backup.id,
      archiveName: validation.backup.archiveName,
      finishedAt
    });
    return successState;
  } catch (error) {
    const finishedAt = Date.now();
    await removeIfExists(PENDING_RESTORE_FILE);
    await writeJson(LAST_RESTORE_FILE, {
      status: 'failed',
      backupId: pendingRestore.backupId,
      archiveName: pendingRestore.archiveName,
      message: error?.message || 'Restore failed.',
      preparedAt: pendingRestore.preparedAt,
      preparedBy: pendingRestore.preparedBy,
      startedAt,
      finishedAt,
      databases: pendingRestore.databases
    });
    logger?.error?.('Pending restore failed', {
      backupId: pendingRestore.backupId,
      archiveName: pendingRestore.archiveName,
      error: error?.message || error
    });
    throw error;
  } finally {
    await removeIfExists(tempDir).catch(() => {});
  }
}

module.exports = {
  BACKUP_ROOT,
  DATABASE_DEFINITIONS,
  createBackup,
  getLatestBackup,
  resolveBackupArchivePath,
  listBackups,
  validateBackup,
  prepareRestore,
  getPendingRestore,
  getLastRestore,
  getRestoreStatus,
  performPendingRestore
};
