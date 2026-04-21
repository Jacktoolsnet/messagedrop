
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmoticonPickerData } from '../../../interfaces/emoticon-picker-data';
import { HelpDialogService } from '../help-dialog/help-dialog.service';

@Component({
  selector: 'app-emoticon-picker',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatTabsModule, TranslocoPipe],
  templateUrl: './emoticon-picker.component.html',
  styleUrls: ['./emoticon-picker.component.css']
})
export class EmoticonPickerComponent {
  readonly categories = [
    {
      name: 'Favs',
      icon: '⭐',
      items: [
        '❤️', '👍', '😀', '😂', '😊', '😢', '😡', '🥳', '🙏', '👏',
        '😎', '🤔', '😴', '🎉', '🍕', '☕', '⚽', '✈️', '🏠', '🚀',
        '😍', '😘', '🤗', '🤯', '😇', '😐', '😮', '😤', '🤝', '🙌',
        '🍺', '🍔', '🍣', '🍩', '🏖️', '🚗', '🎁', '🛼', '🐶', '🌻'
      ]
    },
    // Likely most-used first
    {
      name: 'Faces', icon: '😀', items: [
        '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '🙂', '😉', '😎',
        '😍', '😘', '🤗', '😇', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏',
        '😢', '😭', '😡', '🤯', '🤮', '😴', '🤒', '🤧', '🤕', '😮', '😤', '🥳'
      ]
    },
    { name: 'Hands', icon: '👍', items: ['👍', '👎', '🙏', '👏', '🙌', '🤝', '🤜', '🤛', '✊', '👊', '🤟', '🤘', '🤞', '🤙', '🖖'] },
    { name: 'Love', icon: '💖', items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💑', '💏', '😘', '😗', '😙', '😚'] },
    {
      name: 'Food', icon: '🍕', items: [
        '🍎', '🍔', '🍕', '🍣', '🍪', '🥐', '🍉', '🍌', '🍇', '🍓', '🍍', '🥑',
        '🌭', '🍟', '🌮', '🌯', '🥗', '🍜', '🍝', '🍱', '🍤', '🍥', '🍩', '🍦',
        '🍰', '🧀', '🥚', '🥞', '🥪', '🥙', '🍗', '🥩', '🍲', '🍛', '☕', '🍺'
      ]
    },
    {
      name: 'Sport', icon: '⚽', items: [
        '⚽', '🏀', '🎾', '🏓', '🏋️', '🚴',
        '🏈', '⚾', '🏐', '🏉', '🥎', '⛳', '⛸️', '🎳', '🥊', '🥋', '🏹', '🛼'
      ]
    },
    {
      name: 'Travel', icon: '✈️', items: [
        '🏖️', '✈️', '🚗', '🚲', '🏠', '🎡',
        '🚂', '🚌', '🚢', '🛳️', '🚀', '🗺️', '⛺', '🏕️', '🏰', '🗽', '🏔️', '🌋'
      ]
    },
    { name: 'Party', icon: '🎉', items: ['🎉', '🎊', '🎁', '🎂', '🎈', '🥂', '🍾', '🎵', '🎶', '🎤', '🎸', '🎧', '🎬', '🪩'] },
    { name: 'Animals', icon: '🐶', items: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐧', '🐦', '🦉', '🦆', '🦄'] },
    { name: 'Nature', icon: '🌿', items: ['☀️', '🌤️', '⛈️', '❄️', '🌈', '🌙', '⭐', '🔥', '💧', '🌊', '🌲', '🌵', '🌻', '🌷', '🍂'] },
    { name: 'Symbols', icon: '❤️', items: ['❤️', '💔', '💕', '💯', '💤', '✅', '❌', '❗', '❓', '🔔', '🚫', '⚠️', '♻️'] },
    {
      name: 'Flags', icon: '🏁', items: [
        '🏁', '🇩🇪', '🇦🇹', '🇨🇭', '🇫🇷', '🇪🇸', '🇮🇹', '🇬🇧', '🇺🇸', '🇨🇦', '🇧🇷', '🇯🇵', '🇨🇳', '🇰🇷', '🇮🇳',
        '🇦🇺', '🇳🇿', '🇸🇪', '🇳🇴', '🇫🇮', '🇳🇱', '🇧🇪', '🇨🇿', '🇵🇱', '🇵🇹', '🇬🇷', '🇷🇺', '🇲🇽', '🇦🇷'
      ]
    }
  ];

  readonly dialogRef = inject(MatDialogRef<EmoticonPickerComponent, string | null>);
  readonly data = inject<EmoticonPickerData>(MAT_DIALOG_DATA);
  readonly help = inject(HelpDialogService);
  readonly allowRemove = this.data.allowRemove !== false;
  readonly multiSelect = this.data.multiSelect === true;
  readonly selectedEmojis: string[] = [];

  close(): void {
    this.dialogRef.close();
  }

  pick(reaction: string | null): void {
    if (this.multiSelect && reaction) {
      this.selectedEmojis.push(reaction);
      return;
    }
    this.dialogRef.close(reaction);
  }

  removeLast(): void {
    if (!this.selectedEmojis.length) {
      return;
    }
    this.selectedEmojis.pop();
  }

  clearSelection(): void {
    this.selectedEmojis.splice(0, this.selectedEmojis.length);
  }

  applySelection(): void {
    if (!this.selectedEmojis.length) {
      return;
    }
    this.dialogRef.close(this.selectedEmojis.join(''));
  }

  isEmojiActive(emoji: string): boolean {
    if (this.multiSelect) {
      return this.selectedEmojis.includes(emoji);
    }
    return this.data.current === emoji;
  }
}
