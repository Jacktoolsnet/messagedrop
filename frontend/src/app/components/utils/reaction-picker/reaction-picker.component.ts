import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ReactionPickerData {
  reactions: string[];
  current?: string | null;
}

@Component({
  selector: 'app-reaction-picker',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './reaction-picker.component.html',
  styleUrls: ['./reaction-picker.component.css']
})
export class ReactionPickerComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<ReactionPickerComponent, string | null>,
    @Inject(MAT_DIALOG_DATA) public data: ReactionPickerData
  ) { }

  pick(reaction: string | null): void {
    this.dialogRef.close(reaction);
  }
}
