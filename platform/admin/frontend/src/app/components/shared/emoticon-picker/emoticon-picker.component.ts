import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { EmoticonPickerData } from '../../../interfaces/emoticon-picker-data.interface';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { DialogActionBarComponent } from '../dialog-action-bar/dialog-action-bar.component';

@Component({
  selector: 'app-emoticon-picker',
  imports: [
    MatButtonModule,
    MatDialogContent,
    MatIconModule,
    MatTabsModule,
    DialogActionBarComponent
  ],
  templateUrl: './emoticon-picker.component.html',
  styleUrl: './emoticon-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
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
    {
      name: 'Faces',
      icon: '😀',
      items: [
        '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '🙂', '😉', '😎',
        '😍', '😘', '🤗', '😇', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏',
        '😢', '😭', '😡', '🤯', '🤮', '😴', '🤒', '🤧', '🤕', '😮', '😤', '🥳'
      ]
    },
    { name: 'Hands', icon: '👍', items: ['👍', '👎', '🙏', '👏', '🙌', '🤝', '🤜', '🤛', '✊', '👊', '🤟', '🤘', '🤞', '🤙', '🖖'] },
    { name: 'Love', icon: '💖', items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💑', '💏', '😘', '😗', '😙', '😚'] },
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
      name: 'Sport',
      icon: '⚽',
      items: [
        '⚽', '🏀', '🎾', '🏓', '🏋️', '🚴',
        '🏈', '⚾', '🏐', '🏉', '🥎', '⛳', '⛸️', '🎳', '🥊', '🥋', '🏹', '🛼'
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
    { name: 'Party', icon: '🎉', items: ['🎉', '🎊', '🎁', '🎂', '🎈', '🥂', '🍾', '🎵', '🎶', '🎤', '🎸', '🎧', '🎬', '🪩'] },
    { name: 'Animals', icon: '🐶', items: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐧', '🐦', '🦉', '🦆', '🦄'] },
    { name: 'Nature', icon: '🌿', items: ['☀️', '🌤️', '⛈️', '❄️', '🌈', '🌙', '⭐', '🔥', '💧', '🌊', '🌲', '🌵', '🌻', '🌷', '🍂'] },
    { name: 'Symbols', icon: '❤️', items: ['❤️', '💔', '💕', '💯', '💤', '✅', '❌', '❗', '❓', '🔔', '🚫', '⚠️', '♻️'] },
    {
      name: 'Flags',
      icon: '🏁',
      items: [
        '🏁', '🇩🇪', '🇦🇹', '🇨🇭', '🇫🇷', '🇪🇸', '🇮🇹', '🇬🇧', '🇺🇸', '🇨🇦', '🇧🇷', '🇯🇵', '🇨🇳', '🇰🇷', '🇮🇳',
        '🇦🇺', '🇳🇿', '🇸🇪', '🇳🇴', '🇫🇮', '🇳🇱', '🇧🇪', '🇨🇿', '🇵🇱', '🇵🇹', '🇬🇷', '🇷🇺', '🇲🇽', '🇦🇷'
      ]
    }
  ];

  readonly dialogRef = inject(MatDialogRef<EmoticonPickerComponent, string | null>);
  readonly data = inject<EmoticonPickerData>(MAT_DIALOG_DATA);
  readonly i18n = inject(TranslationHelperService);
  readonly allowRemove = this.data.allowRemove !== false;
  readonly multiSelect = this.data.multiSelect === true;
  readonly selectedEmojis = signal<string[]>([]);

  close(): void {
    this.dialogRef.close();
  }

  pick(emoji: string | null): void {
    if (this.multiSelect && emoji) {
      this.selectedEmojis.update((current) => [...current, emoji]);
      return;
    }

    this.dialogRef.close(emoji);
  }

  removeLast(): void {
    this.selectedEmojis.update((current) => current.length > 0 ? current.slice(0, -1) : current);
  }

  clearSelection(): void {
    this.selectedEmojis.set([]);
  }

  applySelection(): void {
    const selection = this.selectedEmojis();
    if (!selection.length) {
      return;
    }

    this.dialogRef.close(selection.join(''));
  }

  isEmojiActive(emoji: string): boolean {
    if (this.multiSelect) {
      return this.selectedEmojis().includes(emoji);
    }

    return this.data.current === emoji;
  }
}
