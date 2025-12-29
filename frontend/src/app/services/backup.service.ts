import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreatePinComponent } from '../components/pin/create-pin/create-pin.component';
import { BackupEnvelope, BackupLocalImage, BackupPayload } from '../interfaces/backup';
import { GetUserBackupResponse } from '../interfaces/get-user-backup-response';
import { LocalImage } from '../interfaces/local-image';
import { BackupStateService } from './backup-state.service';
import { IndexedDbService } from './indexed-db.service';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';
import { UserService } from './user.service';

type DirectoryPickerWindow = typeof window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle>;
};

@Injectable({
  providedIn: 'root'
})
export class BackupService {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly networkService = inject(NetworkService);
  private readonly userService = inject(UserService);
  private readonly indexedDbService = inject(IndexedDbService);
  private readonly backupState = inject(BackupStateService);
  private readonly i18n = inject(TranslationHelperService);

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      withCredentials: 'true'
    })
  };

  async startBackup(): Promise<void> {
    const userId = this.userService.getUser().id;
    if (!userId) {
      this.snackBar.open(this.i18n.t('common.backup.signInRequired'), undefined, {
        duration: 2500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    const directoryHandle = await this.pickBackupDirectory();
    if (!directoryHandle) {
      return;
    }

    const pin = await this.requestBackupPin();
    if (!pin) {
      return;
    }

    try {
      const payload = await this.buildBackupPayload(userId);
      const envelope = await this.encryptPayload(payload, pin);
      const filename = `${this.formatTimestamp(new Date())}_messagedrop.backup`;
      await this.writeBackupFile(directoryHandle, filename, JSON.stringify(envelope));
      this.backupState.clearDirty();
      this.snackBar.open(this.i18n.t('common.backup.createdSuccess'), undefined, {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    } catch (error) {
      console.error('Backup failed', error);
      this.snackBar.open(this.i18n.t('common.backup.failed'), undefined, {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    }
  }

  private async pickBackupDirectory(): Promise<FileSystemDirectoryHandle | null> {
    const picker = window as DirectoryPickerWindow;
    if (picker.showDirectoryPicker) {
      try {
        return await picker.showDirectoryPicker();
      } catch (error) {
        if (this.isAbortError(error)) {
          return null;
        }
        this.snackBar.open(this.i18n.t('common.backup.folderSelectionFailed'), undefined, {
          duration: 2500,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        return null;
      }
    }

    if (picker.showSaveFilePicker) {
      this.snackBar.open(this.i18n.t('common.backup.folderSelectionUnsupported'), undefined, {
        duration: 3500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      try {
        const handle = await picker.showSaveFilePicker({
          suggestedName: `${this.formatTimestamp(new Date())}_messagedrop.backup`,
          types: [{
            description: this.i18n.t('common.backup.fileTypeDescription'),
            accept: { 'application/octet-stream': ['.backup'] }
          }]
        });
        return this.wrapFileHandleAsDirectory(handle);
      } catch (error) {
        if (this.isAbortError(error)) {
          return null;
        }
        this.snackBar.open(this.i18n.t('common.backup.fileSelectionFailed'), undefined, {
          duration: 2500,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        return null;
      }
    }

    this.snackBar.open(this.i18n.t('common.backup.notSupported'), undefined, {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
    return null;
  }

  private wrapFileHandleAsDirectory(handle: FileSystemFileHandle): FileSystemDirectoryHandle {
    return {
      kind: 'directory',
      name: handle.name,
      async getFileHandle(_name: string, _options?: unknown) {
        void _name;
        void _options;
        return handle;
      }
    } as FileSystemDirectoryHandle;
  }

  private async requestBackupPin(): Promise<string | undefined> {
    const dialogRef = this.dialog.open(CreatePinComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      hasBackdrop: true
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  private async buildBackupPayload(userId: string): Promise<BackupPayload> {
    const serverBackup = await this.fetchServerBackup(userId);
    const indexedDb = await this.indexedDbService.exportAllData(['imageHandle']);
    const localImages = await this.exportLocalImages();

    return {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      userId,
      server: serverBackup,
      indexedDb,
      localImages: localImages.length ? localImages : undefined
    };
  }

  private async fetchServerBackup(userId: string) {
    const url = `${environment.apiUrl}/user/backup/${userId}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: true,
      title: this.i18n.t('common.backup.title'),
      image: '',
      icon: 'cloud_download',
      message: this.i18n.t('common.backup.collectingServerData'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });
    try {
      const response = await firstValueFrom(this.http.get<GetUserBackupResponse>(url, this.httpOptions));
      if (response.status !== 200 || !response.backup) {
        throw new Error('Server backup failed');
      }
      return response.backup;
    } catch (error) {
      const httpError = error as HttpErrorResponse;
      throw new Error(httpError?.message || 'Server backup failed');
    }
  }

  private async exportLocalImages(): Promise<BackupLocalImage[]> {
    const images = await this.indexedDbService.getAllImages();
    if (!images.length) {
      return [];
    }

    const results: BackupLocalImage[] = [];
    for (const image of images) {
      const { fileBase64, fileMissingReason } = await this.readImageBase64(image);
      const { handle: _handle, ...rest } = image;
      void _handle;
      results.push({
        ...rest,
        fileBase64,
        fileMissingReason
      });
    }
    return results;
  }

  private async readImageBase64(image: LocalImage): Promise<{ fileBase64?: string; fileMissingReason?: string }> {
    const handle = image.handle;
    if (!handle || typeof handle.getFile !== 'function') {
      return { fileMissingReason: 'missing_handle' };
    }

    try {
      if (typeof handle.queryPermission === 'function') {
        const status = await handle.queryPermission({ mode: 'read' });
        if (status !== 'granted' && typeof handle.requestPermission === 'function') {
          const requested = await handle.requestPermission({ mode: 'read' });
          if (requested !== 'granted') {
            return { fileMissingReason: 'permission_denied' };
          }
        }
      }

      const file = await handle.getFile();
      const buffer = await file.arrayBuffer();
      return { fileBase64: this.bytesToBase64(new Uint8Array(buffer)) };
    } catch (error) {
      console.error('Failed to read local image', error);
      return { fileMissingReason: 'read_failed' };
    }
  }

  private async encryptPayload(payload: BackupPayload, pin: string): Promise<BackupEnvelope> {
    if (!crypto?.subtle) {
      return {
        format: 'messagedrop-backup',
        version: 1,
        createdAt: payload.createdAt,
        encrypted: false,
        payload: JSON.stringify(payload),
        payloadEncoding: 'utf8'
      };
    }

    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(JSON.stringify(payload));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

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
        iterations: 250000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      payloadBytes
    );

    return {
      format: 'messagedrop-backup',
      version: 1,
      createdAt: payload.createdAt,
      encrypted: true,
      payload: this.bytesToBase64(new Uint8Array(encrypted)),
      payloadEncoding: 'base64',
      kdf: {
        name: 'PBKDF2',
        salt: this.bytesToBase64(salt),
        iterations: 250000,
        hash: 'SHA-256'
      },
      cipher: {
        name: 'AES-GCM',
        iv: this.bytesToBase64(iv)
      }
    };
  }

  private async writeBackupFile(
    directoryHandle: FileSystemDirectoryHandle,
    filename: string,
    content: string
  ): Promise<void> {
    const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  private formatTimestamp(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join('') + '_' + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join('');
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  private isAbortError(error: unknown): boolean {
    return (error instanceof DOMException && error.name === 'AbortError');
  }
}
