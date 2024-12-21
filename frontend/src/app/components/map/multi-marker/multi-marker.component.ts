import { Component, Inject } from '@angular/core';
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
    constructor(public dialogRef: MatDialogRef<MultiMarkerComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { messages: Message[], notes: Note[] }) {
    }
}
