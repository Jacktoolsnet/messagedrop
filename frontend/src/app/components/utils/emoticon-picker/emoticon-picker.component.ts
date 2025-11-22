import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { EmoticonPickerData } from '../../../interfaces/emoticon-picker-data';

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

  constructor(
    private readonly dialogRef: MatDialogRef<EmoticonPickerComponent, string | null>,
    @Inject(MAT_DIALOG_DATA) public data: EmoticonPickerData
  ) { }

  pick(reaction: string | null): void {
    this.dialogRef.close(reaction);
  }
}
