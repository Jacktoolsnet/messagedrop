const fs = require('node:fs/promises');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const BACKUP_ROOT = path.join(REPO_ROOT, 'backups');
const LATEST_METADATA_FILE = path.join(BACKUP_ROOT, 'latest.json');
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
    : `messagedrop-backup-${id}`;

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

  return {
    id,
    createdAt: Number.isFinite(createdAt) ? createdAt : null,
    directoryName,
    archiveName,
    archiveSizeBytes: Number.isFinite(archiveSizeBytes) ? archiveSizeBytes : 0,
    databases,
    downloadPath: `/maintenance/backup/${encodeURIComponent(id)}/download`
  };
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

  await ensureDirectory(BACKUP_ROOT);

  const createdAt = Date.now();
  const id = buildBackupId(new Date(createdAt));
  const directoryName = `messagedrop-backup-${id}`;
  const backupDir = path.join(BACKUP_ROOT, directoryName);
  const archiveName = `${directoryName}.zip`;
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
      databases
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

    await fs.writeFile(LATEST_METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf8');
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
  const stat = await statOrNull(LATEST_METADATA_FILE);
  if (!stat?.isFile()) {
    return null;
  }

  try {
    const raw = await fs.readFile(LATEST_METADATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
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
  } catch {
    return null;
  }
}

function resolveBackupArchivePath(backupId) {
  if (typeof backupId !== 'string' || !BACKUP_ID_PATTERN.test(backupId)) {
    throw new Error('invalid_backup_id');
  }
  return path.join(BACKUP_ROOT, `messagedrop-backup-${backupId}.zip`);
}

module.exports = {
  createBackup,
  getLatestBackup,
  resolveBackupArchivePath
};
