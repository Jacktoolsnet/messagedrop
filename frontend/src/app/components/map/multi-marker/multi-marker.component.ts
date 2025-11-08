import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogClose, MatDialogContent, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ShortNumberPipe } from '../../../pipes/short-number.pipe';
import { MatBadgeModule } from '@angular/material/badge';
import { Message } from '../../../interfaces/message';
import { Note } from '../../../interfaces/note';

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
        MatIcon,
        CommonModule
    ],
    templateUrl: './multi-marker.component.html',
    styleUrl: './multi-marker.component.css'
})
export class MultiMarkerComponent {
    readonly dialogRef = inject(MatDialogRef<MultiMarkerComponent>);
    readonly data = inject<{ messages: Message[]; notes: Note[] }>(MAT_DIALOG_DATA);
}
