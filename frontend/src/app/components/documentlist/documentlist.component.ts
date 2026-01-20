import { Component, computed, effect, inject, OnInit, WritableSignal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { MasonryItemDirective } from '../../directives/masonry-item.directive';
import { BoundingBox } from '../../interfaces/bounding-box';
import { LocalDocument } from '../../interfaces/local-document';
import { Location } from '../../interfaces/location';
import { User } from '../../interfaces/user';
import { GeolocationService } from '../../services/geolocation.service';
import { LocalDocumentService } from '../../services/local-document.service';
import { MapService } from '../../services/map.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { getFileIcon } from '../../utils/file-icon.util';
import { isQuotaExceededError } from '../../utils/storage-error.util';
import { DeleteDocumentComponent } from './delete-document/delete-document.component';

interface DocumentDialogData {
  location: Location;
  documentsSignal: WritableSignal<LocalDocument[]>;
  boundingBox?: BoundingBox;
}

@Component({
  selector: 'app-documentlist',
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    MatIcon,
    MasonryItemDirective,
    TranslocoPipe
  ],
  templateUrl: './documentlist.component.html',
  styleUrl: './documentlist.component.css',
  standalone: true
})
export class DocumentlistComponent implements OnInit {
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogData = inject<DocumentDialogData>(MAT_DIALOG_DATA);
  public readonly userService = inject(UserService);
  private readonly localDocumentService = inject(LocalDocumentService);
  private readonly mapService = inject(MapService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly translation = inject(TranslationHelperService);
  public readonly dialogRef = inject(MatDialogRef<DocumentlistComponent>);
  public readonly dialog = inject(MatDialog);

  readonly hasDocuments = computed(() => this.documentsSignal().length > 0);
  readonly sortedDocuments = computed(() =>
    [...this.documentsSignal()].sort((a, b) => b.timestamp - a.timestamp)
  );
  public user: User | undefined = this.userService.getUser();
  public documentsSignal: WritableSignal<LocalDocument[]> = this.dialogData.documentsSignal;

  constructor() {
    effect(() => {
      this.documentsSignal();
      if (this.dialogData.documentsSignal) {
        this.dialogData.documentsSignal.set(this.documentsSignal());
      }
    });
  }

  async ngOnInit(): Promise<void> {
    if (this.dialogData?.boundingBox) {
      const documents = await this.localDocumentService.getDocumentsInBoundingBox(this.dialogData.boundingBox);
      this.documentsSignal.set(documents);
    }
  }

  goBack(): void {
    this.dialogRef.close();
  }

  flyTo(document: LocalDocument) {
    const location = {
      ...document.location,
      plusCode: this.geolocationService.getPlusCode(document.location.latitude, document.location.longitude)
    };
    if (this.dialogData.boundingBox) {
      this.mapService.fitMapToBounds(this.dialogData.boundingBox);
    } else {
      this.mapService.flyToWithZoom(location, 17);
    }
    this.dialogRef.close();
  }

  navigateToDocumentLocation(document: LocalDocument) {
    this.localDocumentService.navigateToDocumentLocation(this.userService.getUser(), document);
  }

  async openDocument(document: LocalDocument): Promise<void> {
    try {
      await this.localDocumentService.openDocument(document);
    } catch {
      const message = this.localDocumentService.lastErrorSignal() ?? this.translation.t('common.documents.openFailed');
      this.snackBar.open(message, undefined, { duration: 4000 });
    }
  }

  deleteDocument(document: LocalDocument) {
    const dialogRef = this.dialog.open(DeleteDocumentComponent, {
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop-transparent',
      disableClose: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        await this.localDocumentService.deleteDocument(document);
        const updatedDocs = this.documentsSignal().filter(item => item.id !== document.id);
        this.documentsSignal.set(updatedDocs);
      }
    });
  }

  async openAddDocumentDialog(): Promise<void> {
    if (!this.localDocumentService.isSupported()) {
      this.snackBar.open(this.translation.t('common.documents.pickerUnsupported'), undefined, { duration: 4000 });
      return;
    }

    const location = this.dialogData.location ?? this.mapService.getMapLocation();

    try {
      const entries = await this.localDocumentService.createDocumentEntries(location);
      if (!entries.length) {
        return;
      }
      await Promise.all(entries.map(entry => this.localDocumentService.saveDocument(entry)));
      const updatedDocs = [...entries, ...this.documentsSignal()];
      this.documentsSignal.set(updatedDocs);
      this.snackBar.open(this.translation.t('common.documents.importSuccess'), undefined, { duration: 3000 });
    } catch (error) {
      console.error('Failed to add document', error);
      const message = isQuotaExceededError(error)
        ? this.translation.t('common.documents.storageFull')
        : this.translation.t('common.documents.importFailed');
      this.snackBar.open(message, undefined, { duration: 4000 });
    }
  }

  getFileIcon(document: LocalDocument): string {
    return getFileIcon(document.fileName, document.mimeType);
  }

  getFileDate(document: LocalDocument): Date {
    return new Date(document.lastModified ?? document.timestamp);
  }

  formatBytes(value?: number): string | null {
    if (!value || !Number.isFinite(value)) {
      return null;
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    const precision = size >= 100 ? 0 : size >= 10 ? 1 : 2;
    return `${size.toFixed(precision)} ${units[unitIndex]}`;
  }
}
