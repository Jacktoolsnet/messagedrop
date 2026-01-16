import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, inject, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { Place } from '../../../interfaces/place';
import { TileSetting, TileTodoItem } from '../../../interfaces/tile-settings';
import { ContactService } from '../../../services/contact.service';
import { PlaceService } from '../../../services/place.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { TodoTileEditComponent } from './todo-tile-edit/todo-tile-edit.component';

@Component({
  selector: 'app-todo-tile',
  standalone: true,
  imports: [MatIcon, TranslocoPipe],
  templateUrl: './todo-tile.component.html',
  styleUrl: './todo-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodoTileComponent implements OnChanges {
  @Input() tile!: TileSetting;
  @Input() place?: Place;
  @Input() contact?: Contact;

  private readonly dialog = inject(MatDialog);
  private readonly placeService = inject(PlaceService);
  private readonly contactService = inject(ContactService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translation = inject(TranslationHelperService);

  readonly currentTile = signal<TileSetting | null>(null);

  ngOnChanges(): void {
    this.currentTile.set(this.tile);
  }

  get title(): string {
    const tile = this.currentTile();
    const fallback = this.translation.t('common.tileTypes.todo');
    return tile?.payload?.title?.trim() || tile?.label || fallback;
  }

  get icon(): string {
    return this.currentTile()?.payload?.icon || 'list';
  }

  get todos(): TileTodoItem[] {
    const items = this.currentTile()?.payload?.todos ?? [];
    return [...items]
      .map((todo, index) => ({
        ...todo,
        order: Number.isFinite(todo.order) ? todo.order : index
      }))
      .sort((a, b) => a.order - b.order);
  }

  get doneCount(): number {
    return this.todos.filter(todo => todo.done).length;
  }

  get totalCount(): number {
    return this.todos.length;
  }

  editTile(): void {
    const tile = this.currentTile();
    if (!tile) return;

    const dialogRef = this.dialog.open(TodoTileEditComponent, {
      width: '560px',
      maxWidth: '95vw',
      height: 'auto',
      maxHeight: '95vh',
      data: { tile }
    });

    dialogRef.afterClosed().subscribe((updated?: TileSetting) => {
      if (!updated) return;
      this.applyTileUpdate(updated);
    });
  }

  toggleTodo(todo: TileTodoItem, event?: Event): void {
    event?.stopPropagation();
    const tile = this.currentTile();
    if (!tile) return;
    const todos = tile.payload?.todos ?? [];
    const updatedTodos = todos.map(item =>
      item.id === todo.id ? { ...item, done: !item.done } : item
    );
    const updated: TileSetting = {
      ...tile,
      payload: {
        ...tile.payload,
        todos: updatedTodos
      }
    };
    this.applyTileUpdate(updated);
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
