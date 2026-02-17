
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Location } from '../../interfaces/location';
import { Multimedia } from '../../interfaces/multimedia';
import { SharedContent } from '../../interfaces/shared-content';
import { MapService } from '../../services/map.service';
import { SharedContentService } from '../../services/shared-content.service';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';

interface SharedContentDialogData {
  multimedia?: Multimedia;
  location?: Location;
  loadFailed?: boolean;
  content?: SharedContent | null;
}

@Component({
  standalone: true,
  selector: 'app-shared-content',
  imports: [
    DialogHeaderComponent,
    MatDialogContent,
    MatButtonModule,
    MatDialogActions,
    MatDialogClose,
    ShowmultimediaComponent,
    MatDialogModule,
    MatIcon,
    TranslocoPipe
],
  templateUrl: './shared-content.component.html',
  styleUrl: './shared-content.component.css'
})

export class SharedContentComponent implements OnInit {
  private readonly mapService = inject(MapService);
  private readonly sharedContentService = inject(SharedContentService);
  private readonly dialogRef = inject(MatDialogRef<SharedContentComponent>);
  readonly help = inject(HelpDialogService);
  readonly data = inject<SharedContentDialogData>(MAT_DIALOG_DATA);

  public multimedia: Multimedia | undefined = this.data.multimedia;
  public location: Location | undefined = this.data.location;
  public loadFailed = this.data.loadFailed === true;
  private readonly content: SharedContent | null = this.data.content ?? null;

  public async ngOnInit(): Promise<void> {
    if (this.data.location) {
      this.mapService.moveToWithZoom(this.data.location, 17);
    }
  }

  public get hasGenericContent(): boolean {
    return !!this.sharedText || !!this.sharedUrl;
  }

  public get sharedText(): string | null {
    const text = this.content?.text?.trim();
    return text ? text : null;
  }

  public get sharedUrl(): string | null {
    const url = this.content?.url?.trim();
    return url ? url : null;
  }

  public get hasOpenableUrl(): boolean {
    const url = this.sharedUrl;
    if (!url) {
      return false;
    }
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  public openSharedUrl(): void {
    const url = this.sharedUrl;
    if (!url || !this.hasOpenableUrl || typeof window === 'undefined') {
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private clearSharedPayload(keys: string[]): void {
    for (const key of keys) {
      void this.sharedContentService.deleteSharedContent(key);
    }
  }

  public deleteSharedContent(): void {
    this.clearSharedPayload(['last', 'lastMultimedia', 'lastLocation']);
    this.dialogRef.close();
  }

  public deleteSharedLocation(): void {
    if (this.location) {
      this.clearSharedPayload(['last', 'lastLocation']);
    }
    this.dialogRef.close();
  }
}
