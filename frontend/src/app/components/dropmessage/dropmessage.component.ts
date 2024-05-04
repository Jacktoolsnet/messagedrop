import { Component, OnInit } from '@angular/core';
import { MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatDialogModule, MatDialogContainer } from '@angular/material/dialog';

import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { StyleService } from '../../services/style.service';
import { Message } from '../../interfaces/message';

@Component({
  selector: 'app-dropmessage',
  standalone: true,
  imports: [
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
  templateUrl: './dropmessage.component.html',
  styleUrl: './dropmessage.component.css'
})
export class DropmessageComponent implements OnInit {

  public message: string = '';
  
  public messageStyle: string =`
  font-family: 'Caveat'; 
  font-size: 1rem;
  border: 1rem solid #ccc; 
  background-color: #b9b6b6;`;

  constructor(
    public dialogRef: MatDialogRef<DropmessageComponent>,
    private style: StyleService
  ) {}

  ngOnInit(): void {
    this.messageStyle = `
    ${this.style.getRandomFontFamily()}
    ${this.style.getRandomFontSize()}
    ${this.style.getRandomColorCombination()}`;
  }

  onNoClick(): void {
    let message: Message = {'message': this.message, 'style': this.messageStyle};
    this.dialogRef.close(message);
  }
}
