import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, inject, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Contact } from '../../../interfaces/contact';
import { Place } from '../../../interfaces/place';
import { TileLinkType, TileQuickAction, TileSetting } from '../../../interfaces/tile-settings';
import { ContactService } from '../../../services/contact.service';
import { PlaceService } from '../../../services/place.service';
import { QuickActionTileEditComponent } from './quick-action-tile-edit/quick-action-tile-edit.component';

@Component({
  selector: 'app-quick-action-tile',
  standalone: true,
  imports: [MatIcon],
  templateUrl: './quick-action-tile.component.html',
  styleUrl: './quick-action-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickActionTileComponent implements OnChanges {
  @Input() tile!: TileSetting;
  @Input() place?: Place;
  @Input() contact?: Contact;

  private readonly dialog = inject(MatDialog);
  private readonly placeService = inject(PlaceService);
  private readonly contactService = inject(ContactService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly currentTile = signal<TileSetting | null>(null);

  ngOnChanges(): void {
    this.currentTile.set(this.tile);
  }

  get title(): string {
    const tile = this.currentTile();
    return tile?.payload?.title?.trim() || tile?.label || 'Quick actions';
  }

  get icon(): string {
    return this.currentTile()?.payload?.icon || 'bolt';
  }

  get actions(): TileQuickAction[] {
    const items = this.currentTile()?.payload?.actions ?? [];
    return [...items]
      .map((action, index) => ({
        ...action,
        type: action.type ?? 'web',
        order: Number.isFinite(action.order) ? action.order : index
      }))
      .filter(action => action.value?.trim())
      .sort((a, b) => a.order - b.order);
  }

  openEditor(): void {
    const tile = this.currentTile();
    if (!tile) return;

    const dialogRef = this.dialog.open(QuickActionTileEditComponent, {
      width: '560px',
      maxWidth: '95vw',
      maxHeight: '98vh',
      data: { tile }
    });

    dialogRef.afterClosed().subscribe((updated?: TileSetting) => {
      if (!updated) return;
      this.applyTileUpdate(updated);
    });
  }

  triggerAction(action: TileQuickAction, event: Event): void {
    event.stopPropagation();
    const href = this.buildHref(action.value, action.type);
    if (!href) return;
    window.open(href, '_blank');
  }

  getActionLabel(action: TileQuickAction): string {
    return action.label?.trim() || action.value || 'Action';
  }

  getActionIcon(action: TileQuickAction): string {
    return action.icon || this.defaultIconForType(action.type);
  }

  private buildHref(value: string, type: TileLinkType): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    switch (type) {
      case 'web':
        return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      case 'phone':
        return `tel:${trimmed.replace(/\s+/g, '')}`;
      case 'email':
        return trimmed.startsWith('mailto:') ? trimmed : `mailto:${trimmed}`;
      case 'whatsapp':
        return `https://wa.me/${trimmed.replace(/[^0-9+]/g, '')}`;
      case 'sms':
        return `sms:${trimmed.replace(/\s+/g, '')}`;
      case 'map':
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
      default:
        return trimmed;
    }
  }

  private defaultIconForType(type: TileLinkType): string {
    switch (type) {
      case 'phone':
        return 'call';
      case 'email':
        return 'mail';
      case 'whatsapp':
        return 'chat';
      case 'sms':
        return 'sms';
      case 'map':
        return 'map';
      case 'web':
      default:
        return 'public';
    }
  }

  private applyTileUpdate(updated: TileSetting): void {
    if (this.place) {
      const tiles = (this.place.tileSettings ?? []).map(t => t.id === updated.id ? { ...t, ...updated } : t);
      const updatedPlace = { ...this.place, tileSettings: tiles };
      this.place = updatedPlace;
      this.currentTile.set(updated);
      this.placeService.saveAdditionalPlaceInfos(updatedPlace);
    } else if (this.contact) {
      const tiles = (this.contact.tileSettings ?? []).map(t => t.id === updated.id ? { ...t, ...updated } : t);
      this.contact = { ...this.contact, tileSettings: tiles };
      this.currentTile.set(updated);
      this.contactService.saveContactTileSettings(this.contact);
      this.contactService.refreshContact(this.contact.id);
    }
    this.cdr.markForCheck();
  }
}
