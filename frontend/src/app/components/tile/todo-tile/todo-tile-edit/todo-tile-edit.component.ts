import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TileSetting, TileTodoItem } from '../../../../interfaces/tile-settings';
import { TranslocoPipe } from '@jsverse/transloco';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { MaticonPickerComponent } from '../../../utils/maticon-picker/maticon-picker.component';

interface TodoTileDialogData {
  tile: TileSetting;
}

@Component({
  selector: 'app-todo-tile-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIcon,
    A11yModule,
    CdkDrag,
    CdkDropList,
    CdkDragHandle,
    TranslocoPipe
  ],
  templateUrl: './todo-tile-edit.component.html',
  styleUrl: './todo-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodoTileEditComponent {
  private readonly dialogRef = inject(MatDialogRef<TodoTileEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly translation = inject(TranslationHelperService);
  readonly data = inject<TodoTileDialogData>(MAT_DIALOG_DATA);

  readonly titleControl = new FormControl(
    this.data.tile.payload?.title ?? this.data.tile.label ?? this.translation.t('common.tileTypes.todo'),
    { nonNullable: true }
  );
  readonly newTodoControl = new FormControl('', { nonNullable: true });
  readonly icon = signal<string | undefined>(this.data.tile.payload?.icon);
  readonly todos = signal<TileTodoItem[]>(this.normalizeTodos(this.data.tile.payload?.todos));

  get hasTodos(): boolean {
    return this.todos().length > 0;
  }

  pickIcon(): void {
    const ref = this.dialog.open(MaticonPickerComponent, {
      width: '520px',
      data: { current: this.icon() },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop-transparent',
      disableClose: true,
    });

    ref.afterClosed().subscribe((selected?: string | null) => {
      if (selected !== undefined) {
        this.icon.set(selected || undefined);
      }
    });
  }

  addTodo(): void {
    const text = this.newTodoControl.value.trim();
    if (!text) return;
    const updated = [...this.todos(), {
      id: this.createTodoId(),
      text,
      done: false,
      order: this.todos().length
    }];
    this.todos.set(updated);
    this.newTodoControl.setValue('');
  }

  toggleTodo(todo: TileTodoItem): void {
    const updated = this.todos().map(item => item.id === todo.id ? { ...item, done: !item.done } : item);
    this.todos.set(updated);
  }

  deleteTodo(todo: TileTodoItem): void {
    this.todos.set(this.todos().filter(item => item.id !== todo.id));
  }

  drop(event: CdkDragDrop<TileTodoItem[]>) {
    const updated = [...this.todos()];
    moveItemInArray(updated, event.previousIndex, event.currentIndex);
    this.todos.set(updated.map((todo, index) => ({ ...todo, order: index })));
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    const title = this.titleControl.value.trim() || this.translation.t('common.tileTypes.todo');
    const todos = this.normalizeTodos(this.todos()).map((todo, index) => ({ ...todo, order: index }));
    const updated: TileSetting = {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        icon: this.icon(),
        todos
      }
    };
    this.dialogRef.close(updated);
  }

  private normalizeTodos(todos?: TileTodoItem[]): TileTodoItem[] {
    return (todos ?? [])
      .map((todo, index) => ({
        id: todo.id || this.createTodoId(),
        text: (todo.text ?? '').trim(),
        done: !!todo.done,
        order: Number.isFinite(todo.order) ? todo.order : index
      }))
      .filter(todo => todo.text !== '')
      .sort((a, b) => a.order - b.order);
  }

  private createTodoId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
