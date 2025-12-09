
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { LocalImage } from '../../../interfaces/local-image';
import { Message } from '../../../interfaces/message';
import { Note } from '../../../interfaces/note';
import { ShortNumberPipe } from '../../../pipes/short-number.pipe';

@Component({
    selector: 'app-edit-user',
    imports: [
    ShortNumberPipe,
    MatBadgeModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogClose,
    MatIcon
],
    templateUrl: './multi-marker.component.html',
    styleUrl: './multi-marker.component.css'
})
export class MultiMarkerComponent {
    readonly dialogRef = inject(MatDialogRef<MultiMarkerComponent>);
    readonly data = inject<{ messages: Message[]; notes: Note[]; images: LocalImage[] }>(MAT_DIALOG_DATA);
}
