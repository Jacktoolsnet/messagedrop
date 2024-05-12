import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatDialogContainer, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Message } from '../../interfaces/message';
import { MatCardModule}  from '@angular/material/card';
import { StyleService } from '../../services/style.service';
import { Animation } from '../../interfaces/animation';
import { User } from '../../interfaces/user';
import { MessageService } from '../../services/message.service';

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
export class MessagelistComponent implements OnInit{
  public messages!: Message[];
  public user!: User;
  public animation!: Animation;

  constructor(
    private messageService: MessageService,
    public dialogRef: MatDialogRef<MessagelistComponent>,
    private style:StyleService,
    @Inject(MAT_DIALOG_DATA) public data: {user: User, messages: Message[]}
  ) {
    this.user = data.user;
    this.messages = [...data.messages];
  }

  ngOnInit(): void {
    this.animation = this.style.getRandomColorAnimation();
  }

  public navigateToMessageLocation(message: Message){
    this.messageService.navigateToMessageLocation(this.user, message)
  }

}
