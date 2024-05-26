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
    this.getRandomFont();
  }

  onDropClick(): void {
    let message: Message = {
      id: 0,
      parentId: 0,
      typ: 'public',
      createDateTime: '',
      deleteDateTime: '',
      latitude: 0,
      longitude: 0,
      plusCode: '',
      message: this.message,
      markerType: 'default',
      style: this.messageStyle,
      views: 0,
      likes: 0,
      dislikes: 0,
      status: 'enabled',
      userId: ''};
    this.dialogRef.close(message);
  }

  onNewFontClick(): void {
    this.getRandomFont();
  }

  private getRandomFont(): void {
    this.messageStyle = `
    ${this.style.getRandomFontFamily()}
    font-size: 2rem;
    line-height: 1.6;`;
  }

}
