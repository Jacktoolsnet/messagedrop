import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';

export interface EmoticonPickerData {
  reactions: string[];
  current?: string | null;
}

@Component({
  selector: 'app-emoticon-picker',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule, MatTabsModule],
  templateUrl: './emoticon-picker.component.html',
  styleUrls: ['./emoticon-picker.component.css']
})
export class EmoticonPickerComponent {
  readonly categories = [
    {
      name: 'Faces',
      icon: '😀',
      items: [
        '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '🙂', '😉', '😎',
        '😍', '😘', '🤗', '😇', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏',
        '😢', '😭', '😡', '🤯', '🤮', '😴', '🤒', '🤧', '🤕', '😮', '😤', '🥳'
      ]
    },
    {
      name: 'Food',
      icon: '🍕',
      items: [
        '🍎', '🍔', '🍕', '🍣', '🍪', '🥐', '🍉', '🍌', '🍇', '🍓', '🍍', '🥑',
        '🌭', '🍟', '🌮', '🌯', '🥗', '🍜', '🍝', '🍱', '🍤', '🍥', '🍩', '🍦',
        '🍰', '🧀', '🥚', '🥞', '🥪', '🥙', '🍗', '🥩', '🍲', '🍛', '☕', '🍺'
      ]
    },
    {
      name: 'Travel',
      icon: '✈️',
      items: [
        '🏖️', '✈️', '🚗', '🚲', '🏠', '🎡',
        '🚂', '🚌', '🚢', '🛳️', '🚀', '🗺️', '⛺', '🏕️', '🏰', '🗽', '🏔️', '🌋'
      ]
    },
    {
      name: 'Sport',
      icon: '⚽',
      items: [
        '⚽', '🏀', '🎾', '🏓', '🏋️', '🚴',
        '🏈', '⚾', '🏐', '🏉', '🥎', '⛳', '⛸️', '🎳', '🥊', '🥋', '🏹', '🛼'
      ]
    }
  ];

  constructor(
    private readonly dialogRef: MatDialogRef<EmoticonPickerComponent, string | null>,
    @Inject(MAT_DIALOG_DATA) public data: EmoticonPickerData
  ) { }

  pick(reaction: string | null): void {
    this.dialogRef.close(reaction);
  }
}
