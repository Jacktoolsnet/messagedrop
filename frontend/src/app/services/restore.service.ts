import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { CheckPinComponent } from '../components/pin/check-pin/check-pin.component';
import { DeleteUserComponent } from '../components/user/delete-user/delete-user.component';
import { BackupEnvelope, BackupLocalImage, BackupMediaFile, BackupPayload, UserServerBackup } from '../interfaces/backup';
import { IndexedDbBackup } from '../interfaces/indexed-db-backup';
import { LocalImage } from '../interfaces/local-image';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { BackupStateService } from './backup-state.service';
import { AvatarStorageService } from './avatar-storage.service';
import { IndexedDbService } from './indexed-db.service';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';
import { UserService } from './user.service';

type FilePickerWindow = typeof window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: {
      description?: string;
      accept: Record<string, string[]>;
    }[];
    excludeAcceptAllOption?: boolean;
  }) => Promise<FileSystemFileHandle[]>;
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
};

@Injectable({
  providedIn: 'root'
})
export class RestoreService {
  private restoreInProgress = false;

  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly userService = inject(UserService);
  private readonly avatarStorage = inject(AvatarStorageService);
  private readonly indexedDbService = inject(IndexedDbService);
  private readonly networkService = inject(NetworkService);
  private readonly backupState = inject(BackupStateService);
  private readonly i18n = inject(TranslationHelperService);

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      withCredentials: 'true'
    })
  };

  async startRestore(): Promise<void> {
    if (this.restoreInProgress) {
      return;
    }

    const hasUser = await this.indexedDbService.hasUser();
    if (hasUser && !this.userService.isReady()) {
      this.userService.login(() => {
        this.startRestore();
      });
      return;
    }

    this.restoreInProgress = true;

    try {
      const backupFile = await this.pickBackupFile();
      if (!backupFile) {
        return;
      }

      const envelope = this.parseEnvelope(await backupFile.text());
      if (!envelope) {
        return;
      }

      const pin = await this.requestPin();
      if (!pin) {
        return;
      }

      const payload = await this.decryptEnvelope(envelope, pin);
      if (!payload) {
        return;
      }

      if (payload.schemaVersion !== 1 || payload.server.schemaVersion !== 1) {
        this.snackBar.open(this.i18n.t('common.restore.versionUnsupported'), undefined, {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        return;
      }

      if (!payload.server || !payload.indexedDb) {
        this.snackBar.open(this.i18n.t('common.restore.missingData'), undefined, {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        return;
      }

      if (hasUser && this.userService.isReady()) {
        if (this.hasKeyMismatch(payload)) {
          this.snackBar.open(this.i18n.t('common.restore.keysMismatch'), undefined, {
            duration: 3500,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
          return;
        }
        const confirmed = await this.confirmOverwrite(payload.userId);
        if (!confirmed) {
          return;
        }

        const deleted = await this.deleteCurrentUser();
        if (!deleted) {
          return;
        }
      }

      await this.indexedDbService.clearAllData();
      await this.restoreServerData(payload.server);
      await this.restoreIndexedDb(payload.indexedDb);
      await this.restoreLocalImages(payload.localImages || []);
      await this.restoreMediaFiles(payload.mediaFiles || []);

      this.backupState.clearDirty();
      this.userService.logout();
      this.snackBar.open(this.i18n.t('common.restore.completed'), undefined, {
        duration: 3500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    } catch (error) {
      console.error('Restore failed', error);
      this.snackBar.open(this.i18n.t('common.restore.failed'), undefined, {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    } finally {
      this.restoreInProgress = false;
    }
  }

  private async pickBackupFile(): Promise<File | null> {
    const picker = window as FilePickerWindow;
    if (picker.showOpenFilePicker) {
      try {
        const handles = await picker.showOpenFilePicker({
          multiple: false,
          excludeAcceptAllOption: true,
          types: [
            {
              description: this.i18n.t('common.backup.fileTypeDescription'),
              accept: {
                'application/octet-stream': ['.backup'],
                'application/json': ['.backup', '.json']
              }
            }
          ]
        });
        const handle = handles[0];
        if (!handle) {
          return null;
        }
        return await handle.getFile();
      } catch (error) {
        if (this.isAbortError(error)) {
          return null;
        }
        this.snackBar.open(this.i18n.t('common.restore.fileSelectionFailed'), undefined, {
          duration: 2500,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        return null;
      }
    }

    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.backup,application/json';
      input.onchange = () => {
        const file = input.files?.[0] ?? null;
        resolve(file);
      };
      input.click();
    });
  }

  private parseEnvelope(content: string): BackupEnvelope | null {
    try {
      const parsed = JSON.parse(content) as BackupEnvelope;
      if (!parsed || parsed.format !== 'messagedrop-backup') {
        this.snackBar.open(this.i18n.t('common.restore.invalidFile'), undefined, {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        return null;
      }
      return parsed;
    } catch {
      this.snackBar.open(this.i18n.t('common.restore.readFailed'), undefined, {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return null;
    }
  }

  private async requestPin(): Promise<string | undefined> {
    const dialogRef = this.dialog.open(CheckPinComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      hasBackdrop: true
    });
    const pin = await firstValueFrom(dialogRef.afterClosed());
    return pin;
  }

  private async decryptEnvelope(envelope: BackupEnvelope, pin: string): Promise<BackupPayload | null> {
    if (!envelope.encrypted) {
      try {
        if (envelope.payloadEncoding === 'base64') {
          const decoded = new TextDecoder().decode(this.base64ToArrayBuffer(envelope.payload));
          return JSON.parse(decoded) as BackupPayload;
        }
        return JSON.parse(envelope.payload) as BackupPayload;
      } catch {
        this.snackBar.open(this.i18n.t('common.restore.corrupted'), undefined, {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        return null;
      }
    }

    if (!crypto?.subtle || !envelope.kdf || !envelope.cipher) {
      this.snackBar.open(this.i18n.t('common.restore.encryptedNotSupported'), undefined, {
        duration: 3500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return null;
    }

    try {
      const encoder = new TextEncoder();
      const salt = this.base64ToArrayBuffer(envelope.kdf.salt);
      const iv = this.base64ToArrayBuffer(envelope.cipher.iv);

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(pin),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: envelope.kdf.iterations,
          hash: envelope.kdf.hash
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        this.base64ToArrayBuffer(envelope.payload)
      );

      const decoded = new TextDecoder().decode(decrypted);
      return JSON.parse(decoded) as BackupPayload;
    } catch {
      this.snackBar.open(this.i18n.t('common.restore.pinIncorrect'), undefined, {
        duration: 3500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return null;
    }
  }

  private async confirmOverwrite(backupUserId: string): Promise<boolean> {
    const currentUserId = this.userService.getUser().id;
    const userHint = backupUserId && backupUserId !== currentUserId
      ? this.i18n.t('common.restore.overwriteUserHint', { userId: backupUserId })
      : '';
    const baseMessage = this.i18n.t('common.restore.overwriteMessage');
    const message = userHint ? `${baseMessage}\n\n${userHint}` : baseMessage;

    const dialogRef = this.dialog.open(DeleteUserComponent, {
      data: {
        title: this.i18n.t('common.restore.overwriteTitle'),
        message,
        confirmLabel: this.i18n.t('common.actions.restore'),
        cancelLabel: this.i18n.t('common.cancel')
      },
      closeOnNavigation: true,
      hasBackdrop: true
    });

    return (await firstValueFrom(dialogRef.afterClosed())) === true;
  }

  private async deleteCurrentUser(): Promise<boolean> {
    const userId = this.userService.getUser().id;
    if (!userId) {
      return true;
    }

    try {
      const response = await firstValueFrom(this.userService.deleteUser(userId, true));
      if (response.status !== 200) {
        this.snackBar.open(this.i18n.t('common.restore.deleteUserFailed'), undefined, {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        return false;
      }
      await this.indexedDbService.clearAllData();
      this.userService.logout();
      return true;
    } catch (error) {
      console.error('Failed to delete user before restore', error);
      this.snackBar.open(this.i18n.t('common.restore.deleteUserFailed'), undefined, {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return false;
    }
  }

  private async restoreServerData(backup: UserServerBackup): Promise<void> {
    const url = `${environment.apiUrl}/user/restore`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: true,
      title: this.i18n.t('common.restore.title'),
      image: '',
      icon: 'cloud_download',
      message: this.i18n.t('common.restore.restoringServerData'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });

    try {
      const response = await firstValueFrom(
        this.http.post<SimpleStatusResponse>(url, { backup }, this.httpOptions)
      );
      if (response.status !== 200) {
        throw new Error('Server restore failed');
      }
    } catch (error) {
      const httpError = error as HttpErrorResponse;
      throw new Error(httpError?.message || 'Server restore failed');
    }
  }

  private async restoreIndexedDb(backup: IndexedDbBackup): Promise<void> {
    const result = await this.indexedDbService.importAllData(backup);
    if (result.skippedStores.length) {
      console.warn('Skipped restoring stores:', result.skippedStores);
    }
  }

  private async restoreLocalImages(localImages: BackupLocalImage[]): Promise<void> {
    if (!localImages.length) {
      return;
    }

    const restorable = localImages.filter((image) => Boolean(image.fileBase64));
    if (!restorable.length) {
      return;
    }

    const picker = window as FilePickerWindow;
    if (!picker.showDirectoryPicker) {
      this.snackBar.open(this.i18n.t('common.restore.imageRestoreUnsupported'), undefined, {
        duration: 3500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    let directoryHandle: FileSystemDirectoryHandle | null = null;
    try {
      directoryHandle = await picker.showDirectoryPicker();
    } catch (error) {
      if (this.isAbortError(error)) {
        return;
      }
      this.snackBar.open(this.i18n.t('common.restore.imageRestoreSkipped'), undefined, {
        duration: 2500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    for (const image of restorable) {
      const fileName = this.buildImageFileName(image);
      const handle = await directoryHandle.getFileHandle(fileName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(this.base64ToArrayBuffer(image.fileBase64 || ''));
      await writable.close();

      const entry: LocalImage = {
        id: image.id,
        handle,
        fileName,
        mimeType: image.mimeType || 'application/octet-stream',
        width: image.width,
        height: image.height,
        exifCaptureDate: image.exifCaptureDate,
        hasExifLocation: image.hasExifLocation ?? false,
        location: image.location || { latitude: 0, longitude: 0, plusCode: '' },
        timestamp: image.timestamp
      };

      await this.indexedDbService.saveImage(entry);
    }
  }

  private async restoreMediaFiles(mediaFiles: BackupMediaFile[]): Promise<void> {
    if (!mediaFiles.length) {
      return;
    }
    if (!this.avatarStorage.isSupported()) {
      this.snackBar.open(this.i18n.t('common.media.storageUnsupported'), undefined, {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    for (const file of mediaFiles) {
      if (!file.fileBase64) {
        continue;
      }
      const kind = file.id.startsWith('background-') ? 'background' : 'avatar';
      await this.avatarStorage.saveImageFromBase64(kind, file.fileBase64, file.id);
    }
  }

  private hasKeyMismatch(payload: BackupPayload): boolean {
    if (!this.userService.isReady()) {
      return false;
    }
    const currentUser = this.userService.getUser();
    if (!currentUser?.id || currentUser.id !== payload.userId) {
      return false;
    }
    const tableUser = (payload.server?.tables?.['tableUser'] ?? []) as Array<Record<string, unknown>>;
    const backupRow = tableUser.find((row) => row['id'] === payload.userId) ?? tableUser[0];
    if (!backupRow) {
      return false;
    }

    const backupSigning = this.normalizeKeyValue(backupRow['signingPublicKey']);
    const backupCrypto = this.normalizeKeyValue(backupRow['cryptoPublicKey']);
    const currentSigning = this.normalizeKeyValue(currentUser.signingKeyPair?.publicKey);
    const currentCrypto = this.normalizeKeyValue(currentUser.cryptoKeyPair?.publicKey);

    if (!backupSigning || !backupCrypto || !currentSigning || !currentCrypto) {
      return false;
    }

    return backupSigning !== currentSigning || backupCrypto !== currentCrypto;
  }

  private normalizeKeyValue(value: unknown): string | null {
    if (!value) {
      return null;
    }
    if (typeof value === 'string') {
      try {
        return this.stableStringify(JSON.parse(value));
      } catch {
        return value;
      }
    }
    return this.stableStringify(value);
  }

  private stableStringify(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.stableStringify(entry)).join(',')}]`;
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => `"${key}":${this.stableStringify(val)}`);
      return `{${entries.join(',')}}`;
    }
    return JSON.stringify(value);
  }

  private buildImageFileName(image: BackupLocalImage): string {
    if (image.fileName && image.fileName.trim()) {
      return image.fileName;
    }
    const extension = this.extensionFromMime(image.mimeType);
    return extension ? `${image.id}.${extension}` : `${image.id}.bin`;
  }

  private extensionFromMime(mimeType?: string): string | null {
    if (!mimeType) {
      return null;
    }
    const match = mimeType.split('/')[1];
    return match ? match.replace(/[^a-z0-9]/gi, '') : null;
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return buffer;
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
  }
}
