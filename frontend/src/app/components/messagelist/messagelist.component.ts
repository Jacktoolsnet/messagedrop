import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatDialogContainer, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';

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
import { MapService } from '../../services/map.service';
import { Location } from '../../interfaces/location';
import { GeolocationService } from '../../services/geolocation.service';
import { MatBadgeModule } from '@angular/material/badge';
import { ShortNumberPipe } from '../../pipes/short-number.pipe';
import { BlockmessageComponent } from './blockmessage/blockmessage.component';
import { DeletemessageComponent } from './deletemessage/deletemessage.component';
import { EditUserComponent } from './edit-user/edit-user.component';
import { RelatedUserService } from '../../services/related-user.service';
import { RelatedUser } from '../../interfaces/related-user';
import { MessageMode } from '../../interfaces/message-mode';
import { MessageComponent } from '../message/message.component';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-messagelist',
  standalone: true,
  imports: [
    ShortNumberPipe,
    MatBadgeModule,
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
  public selectedMessages: Message[] = [];
  public selectedMessageUser!: RelatedUser;
  public user!: User;
  public animation!: Animation;
  public likeButtonColor: string = 'secondary';
  public dislikeButtonColor: string = 'secondary';
  public messageMode: typeof MessageMode = MessageMode;
  private snackBarRef: any;

  constructor(
    private messageService: MessageService,
    private mapService: MapService,
    private geolocationService: GeolocationService,
    private relatedUserService: RelatedUserService,
    public dialogRef: MatDialogRef<MessagelistComponent>,
    public messageDialog: MatDialog,
    public dialog: MatDialog,
    private style:StyleService,
    private snackBar: MatSnackBar, 
    @Inject(MAT_DIALOG_DATA) public data: {user: User, messages: Message[]}
  ) {
    this.user = data.user;
    this.messages = [...data.messages];
  }

  ngOnInit(): void {
    this.animation = this.style.getRandomColorAnimation();
  }

  public flyTo(message: Message){
    let location: Location = {
      latitude: message.latitude,
      longitude: message.longitude,
      zoom: 17,
      plusCode: this.geolocationService.getPlusCode(message.latitude, message.longitude)
    }
    this.mapService.setCircleMarker(location);
    this.mapService.setDrawCircleMarker(true);
    this.mapService.flyTo(location);
    this.dialogRef.close();
  }

  public navigateToMessageLocation(message: Message){
    this.messageService.navigateToMessageLocation(this.user, message)
  }

  public goBack() {
    this.selectedMessages.pop();
    this.likeButtonColor = 'secondary';
    this.dislikeButtonColor = 'secondary';
  }

  public goToMessageDetails(message: Message) {
    this.selectedMessages.push(message);
    this.selectedMessageUser = this.relatedUserService.loadUser(message.userId);
    if (this.user.id !== message.userId) {
      this.messageCountView(message);
    }
    this.messageLikedByUser(message);
    this.messageDislikedByUser(message);
  }

  public getMessageUserName(message: Message): RelatedUser {
    return this.relatedUserService.loadUser(message.userId);
  }

  public likeMessage(message: Message) {
    if (!message.likedByUser) {
      this.messageService.likeMessage(message, this.user)
              .subscribe({
                next: (simpleStatusResponse) => {
                  if (simpleStatusResponse.status === 200) {
                    message.likes = message.likes + 1;
                    this.likeButtonColor = 'primary';
                    message.likedByUser = true;
                  }
                },
                error: (err) => {
                },
                complete:() => {}
              });
    } else {
      this.messageService.unlikeMessage(message, this.user)
              .subscribe({
                next: (simpleStatusResponse) => {
                  if (simpleStatusResponse.status === 200) {
                    message.likes = message.likes - 1;
                    this.likeButtonColor = 'secondary';
                    message.likedByUser = false;
                  }
                },
                error: (err) => {
                },
                complete:() => {}
              });
    }
  }

  public messageLikedByUser(message: Message) {
    this.messageService.messageLikedByUser(message, this.user)
            .subscribe({
              next: (likedByUserResponse) => {
                if (likedByUserResponse.status === 200 && likedByUserResponse.likedByUser) {
                  this.likeButtonColor = 'primary';
                  message.likedByUser = true;
                } else {
                  this.likeButtonColor = 'secondary';
                  message.likedByUser = false;
                }
              },
              error: (err) => {
              },
              complete:() => {}
            });
  }

  public dislikeMessage(message: Message) {
    if (!message.dislikedByUser) {
      this.messageService.dislikeMessage(message, this.user)
              .subscribe({
                next: (simpleStatusResponse) => {
                  if (simpleStatusResponse.status === 200) {
                    message.dislikes = message.dislikes + 1;
                    this.dislikeButtonColor = 'primary';
                    message.dislikedByUser = true;
                  }
                },
                error: (err) => {
                },
                complete:() => {}
              });
    } else {
      this.messageService.undislikeMessage(message, this.user)
              .subscribe({
                next: (simpleStatusResponse) => {
                  if (simpleStatusResponse.status === 200) {
                    message.dislikes = message.dislikes - 1;
                    this.dislikeButtonColor = 'secondary';
                    message.dislikedByUser = false;
                  }
                },
                error: (err) => {
                },
                complete:() => {}
              });
    }
  }

  public messageDislikedByUser(message: Message) {
    this.messageService.messageDislikedByUser(message, this.user)
            .subscribe({
              next: (dislikedByUserResponse) => {
                if (dislikedByUserResponse.status === 200 && dislikedByUserResponse.dislikedByUser) {
                  this.dislikeButtonColor = 'primary';
                  message.dislikedByUser = true;
                } else {
                  this.dislikeButtonColor = 'secondary';
                  message.dislikedByUser = false;
                }
              },
              error: (err) => {
              },
              complete:() => {}
            });
  }

  private messageCountView(message: Message) {
    this.messageService.countView(message)
            .subscribe({
              next: (likedByUserResponse) => {
                if (likedByUserResponse.status === 200) {
                  message.views = message.views + 1;
                }
              },
              error: (err) => {
              },
              complete:() => {}
            });
  }

  public disableMessage(message: Message) {
    const dialogRef = this.dialog.open(BlockmessageComponent, {
      hasBackdrop: true 
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.messageService.disableMessage(message)
              .subscribe({
                next: (simpleStatusResponse) => {
                  if (simpleStatusResponse.status === 200) {
                    this.messages = this.messages.filter( element => element.id !== message.id );
                    this.selectedMessages.pop();
                  }
                },
                error: (err) => {
                },
                complete:() => {}
              });
      }
    });
  }

  public deleteMessage(message: Message) {
    const dialogRef = this.dialog.open(DeletemessageComponent, {
      hasBackdrop: true 
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.messageService.deleteMessage(message)
              .subscribe({
                next: (simpleStatusResponse) => {
                  if (simpleStatusResponse.status === 200) {
                    this.messages = this.messages.filter( element => element.id !== message.id );
                    this.selectedMessages.pop();
                  }
                },
                error: (err) => {
                },
                complete:() => {}
              });
      }
    });
  }

  public editMessage(message: Message) {
    // For developement == else !=
    if (message.userId != this.user.id) {
      // Edit user of this message
      if (undefined === this.selectedMessageUser.id || this.selectedMessageUser.id != message.userId) {
        this.selectedMessageUser.id = message.userId;
      }
      const dialogRef = this.dialog.open(EditUserComponent, {
        data: {relatedUser: this.selectedMessageUser},
        hasBackdrop: true 
      });
  
      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.relatedUserService.saveUser(result);
        }
      });
    } else {
      const dialogRef = this.messageDialog.open(MessageComponent, {
        panelClass: 'messageDialog',
        data: {mode: this.messageMode.EDIT, user: this.user, message: message},
        width: '90vh',
        height: '90vh',
        maxHeight: '90vh',
        maxWidth:'90vw',
        hasBackdrop: true      
      });
  
      dialogRef.afterClosed().subscribe((message: Message) => {
        if (undefined !== message) {
          console.log(message);        
        }
      });
    }
  }
}
