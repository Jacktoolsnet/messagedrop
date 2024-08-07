import { CUSTOM_ELEMENTS_SCHEMA, Component, Inject, OnInit } from '@angular/core';
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
import { BlockMessageComponent } from './block-message/block-message.component';
import { DeleteMessageComponent } from './delete-message/delete-message.component';
import { EditUserComponent } from './edit-user/edit-user.component';
import { RelatedUserService } from '../../services/related-user.service';
import { RelatedUser } from '../../interfaces/related-user';
import { Mode } from '../../interfaces/mode';
import { MessageComponent } from '../message/message.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateService } from '../../services/translate.service';

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
    MatMenuModule,
    MatInputModule
  ],
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
  public mode: typeof Mode = Mode;
  private snackBarRef: any;
  public comments: Message[] = [];

  constructor(
    private messageService: MessageService,
    private translateService: TranslateService,
    private mapService: MapService,
    private geolocationService: GeolocationService,
    private relatedUserService: RelatedUserService,
    public dialogRef: MatDialogRef<MessagelistComponent>,
    public messageDialog: MatDialog,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private style:StyleService,
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
    if (this.selectedMessages.length == 0) {
      this.dialogRef.close();
    } else {
      this.selectedMessages.pop();
      this.likeButtonColor = 'secondary';
      this.dislikeButtonColor = 'secondary';
      if (this.selectedMessages.length > 0) {
        this.getComments(this.selectedMessages[this.selectedMessages.length - 1])
      } else {
        this.comments = [];
      }
    }
  }

  public goToMessageDetails(message: Message) {
    this.selectedMessages.push(message);
    this.selectedMessageUser = this.relatedUserService.loadUser(message.userId);
    if (this.user.id !== message.userId) {
      this.messageCountView(message);
    }
    this.messageLikedByUser(message);
    this.messageDislikedByUser(message);
    this.getComments(this.selectedMessages[this.selectedMessages.length - 1])
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
              next: (SimpleStatusResponse) => {
                if (SimpleStatusResponse.status === 200) {
                  message.views = message.views + 1;
                }
              },
              error: (err) => {
              },
              complete:() => {}
            });
  }

  private countComment(parentMessage: Message) {
    this.messageService.countComment(parentMessage)
            .subscribe({
              next: (SimpleStatusResponse) => {
                if (SimpleStatusResponse.status === 200) {
                  parentMessage.comments = parentMessage.comments + 1;
                }
              },
              error: (err) => {
              },
              complete:() => {}
            });
  }

  public disableMessage(message: Message) {
    const dialogRef = this.dialog.open(BlockMessageComponent, {
      closeOnNavigation: true,
      hasBackdrop: true 
    });

    dialogRef.afterOpened().subscribe(e => {
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
    const dialogRef = this.dialog.open(DeleteMessageComponent, {
      closeOnNavigation: true,
      hasBackdrop: true 
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.messageService.deleteMessage(message)
              .subscribe({
                next: (simpleStatusResponse) => {
                  if (simpleStatusResponse.status === 200) {
                    this.messages = this.messages.filter( element => element.id !== message.id );
                    this.selectedMessages.pop();
                    if (this.messages.length === 0) {
                      this.dialogRef.close();
                    }
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
    const dialogRef = this.messageDialog.open(MessageComponent, {
      panelClass: '',
      data: {mode: message.parentId == null ? this.mode.EDIT_PUBLIC_MESSAGE : this.mode.EDIT_COMMENT, user: this.user, message: message},
      closeOnNavigation: true,
      width: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      maxWidth:'90vw',
      hasBackdrop: true      
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.message) {
        this.messageService.updateMessage(data.message, this.mapService.getMapLocation(), data.user)
            .subscribe({
              next: createMessageResponse => {
                this.snackBarRef = this.snackBar.open(`Message succesfully dropped.`, '', {duration: 1000});
              },
              error: (err) => {this.snackBarRef = this.snackBar.open(err.message, 'OK');},
              complete:() => {}
            });          
      }
    });
  }

  public editMessageUserProfile(message: Message){
    if (undefined === this.selectedMessageUser.id || this.selectedMessageUser.id != message.userId) {
      this.selectedMessageUser.id = message.userId;
    }
    const dialogRef = this.dialog.open(EditUserComponent, {
      data: {relatedUser: this.selectedMessageUser},
      closeOnNavigation: true,
      hasBackdrop: true 
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.relatedUserService.saveUser(result);
      }
    });
  }

  public addComment(parentMessage: Message) {
    let message: Message = {
      id: 0,
      parentId: parentMessage.id,
      typ: 'public',
      createDateTime: '',
      deleteDateTime: '',
      latitude: parentMessage.latitude,
      longitude: parentMessage.longitude,
      plusCode: parentMessage.plusCode,
      message: '',
      markerType: 'none',
      style: '',
      views: 0,
      likes: 0,
      dislikes: 0,
      comments: 0,
      status: 'enabled',
      userId: ''};

    const dialogRef = this.messageDialog.open(MessageComponent, {
      panelClass: '',
      data: {mode: this.mode.ADD_COMMENT, user: this.user, message: message},
      closeOnNavigation: true,
      width: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      maxWidth:'90vw',
      hasBackdrop: true      
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data.message) {
        this.messageService.createMessage(data.message, this.mapService.getMapLocation(), data.user)
            .subscribe({
              next: createMessageResponse => {
                this.countComment(parentMessage);
                this.snackBarRef = this.snackBar.open(`Message succesfully dropped.`, '', {duration: 1000});
              },
              error: (err) => {this.snackBarRef = this.snackBar.open(err.message, 'OK');},
              complete:() => {this.comments.push(data.message);}
            });          
      }
    });
  }

  getComments(parentMessage: Message) {
    this.messageService.getCommentsForParentMessage(parentMessage)
            .subscribe({
              next: (getMessageResponse) => {
                this.comments = [...getMessageResponse.rows];
              },
              error: (err) => {
                this.comments = [];
              },
              complete:() => {}
            });
  }

  public translateMessage(message: Message) {
    this.translateService.translate(message.message, this.user.language)
              .subscribe({
                next: (translateResponse) => {
                  if (translateResponse.status === 200) {
                    message.translatedMessage = translateResponse.result?.text;
                  }
                },
                error: (translateResponse) => {
                  this.snackBarRef = this.snackBar.open(translateResponse.error.error, '', {duration: 3000});
                },
                complete:() => {}
              });
  }

  openMessagDialog(): void {
    let message: Message = {
      id: 0,
      parentId: 0,
      typ: 'public',
      createDateTime: '',
      deleteDateTime: '',
      latitude: 0,
      longitude: 0,
      plusCode: '',
      message: '',
      markerType: 'default',
      style: '',
      views: 0,
      likes: 0,
      dislikes: 0,
      comments: 0,
      status: 'enabled',
      userId: ''};
    const dialogRef = this.messageDialog.open(MessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {mode: this.mode.ADD_PUBLIC_MESSAGE, user: this.user, message: message},
      width: '90vw',
      minWidth: '20vw',
      maxWidth:'90vw',
      minHeight: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      hasBackdrop: true      
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.message) {
        this.messageService.createMessage(data.message, this.mapService.getMapLocation(), data.user)
            .subscribe({
              next: createMessageResponse => {
                this.messages = [data?.message, ...this.messages];
                this.snackBarRef = this.snackBar.open(`Message succesfully dropped.`, '', {duration: 1000});
              },
              error: (err) => {this.snackBarRef = this.snackBar.open(err.message, 'OK');},
              complete:() => {}
            });          
      }
    });
  }
}
