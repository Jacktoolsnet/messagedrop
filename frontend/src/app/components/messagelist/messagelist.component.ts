import { Component, Inject } from '@angular/core';
import { MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatDialogModule, MatDialogContainer, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Message } from '../../interfaces/message';
import {MatCardModule} from '@angular/material/card';
import { StyleService } from '../../services/style.service';


@Component({
  selector: 'app-messagelist',
  standalone: true,
  imports: [
    MatCardModule,
    MatDialogContainer,
    CommonModule, 
    FormsModule, 
    MatButtonModule, 
    MatDialogActions, 
    MatDialogClose, 
    MatDialogTitle, 
    MatDialogContent, 
    MatIcon, 
    FormsModule, 
    MatFormFieldModule, 
    MatInputModule],
  templateUrl: './messagelist.component.html',
  styleUrl: './messagelist.component.css'
})
export class MessagelistComponent {
  public messages!: Message[];

  constructor(
    public dialogRef: MatDialogRef<MessagelistComponent>,
    public style:StyleService,
    @Inject(MAT_DIALOG_DATA) public data: Message[]
  ) {
    this.messages = [...data];
  }
}
