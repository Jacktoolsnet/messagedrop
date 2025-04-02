import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogContent, MatDialogRef } from '@angular/material/dialog';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Animation } from '../../interfaces/animation';
import { Location } from '../../interfaces/location';
import { Message } from '../../interfaces/message';
import { Mode } from '../../interfaces/mode';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { RelatedUser } from '../../interfaces/related-user';
import { User } from '../../interfaces/user';
import { ShortNumberPipe } from '../../pipes/short-number.pipe';
import { GeolocationService } from '../../services/geolocation.service';
import { MapService } from '../../services/map.service';
import { MessageService } from '../../services/message.service';
import { RelatedUserService } from '../../services/related-user.service';
import { StyleService } from '../../services/style.service';
import { TranslateService } from '../../services/translate.service';
import { EditMessageComponent } from '../editmessage/edit-message.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { ShowmessageComponent } from '../showmessage/showmessage.component';
import { BlockMessageComponent } from './block-message/block-message.component';
import { DeleteMessageComponent } from './delete-message/delete-message.component';
import { EditUserComponent } from './edit-user/edit-user.component';

@Component({
  selector: 'app-messagelist',
  imports: [
    ShowmessageComponent,
    ShowmultimediaComponent,
    ShortNumberPipe,
    MatBadgeModule,
    MatCardModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
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
export class MessagelistComponent implements OnInit {
  public messages!: Message[];
  public selectedMessageUser!: RelatedUser;
  public user!: User;
  public animation!: Animation;
  public likeButtonColor: string = 'secondary';
  public dislikeButtonColor: string = 'secondary';
  public mode: typeof Mode = Mode;

  constructor(
    public messageService: MessageService,
    private translateService: TranslateService,
    private mapService: MapService,
    private geolocationService: GeolocationService,
    private relatedUserService: RelatedUserService,
    public dialogRef: MatDialogRef<any>,
    public messageDialog: MatDialog,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: { user: User, messages: Message[] }
  ) {
    this.user = data.user;
    this.messages = data.messages;
  }

  ngOnInit(): void {
    this.animation = this.style.getRandomColorAnimation();
  }

  public flyTo(message: Message) {
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

  public navigateToMessageLocation(message: Message) {
    this.messageService.navigateToMessageLocation(this.user, message)
  }

  public goBack() {
    if (this.messageService.getSelectedMessages().length == 0) {
      this.dialogRef.close();
    } else {
      this.messageService.getSelectedMessages().pop();
      this.likeButtonColor = 'secondary';
      this.dislikeButtonColor = 'secondary';
    }
  }

  public goToMessageDetails(message: Message) {
    this.messageService.getSelectedMessages().push(message);
    this.selectedMessageUser = this.relatedUserService.loadUser(message.userId);
    if (this.user.id !== message.userId) {
      this.messageCountView(message);
    }
    this.messageLikedByUser(message);
    this.messageDislikedByUser(message);
    this.messageService.getCommentsForParentMessage(message);
  }

  public getMessageUserName(message: Message): RelatedUser {
    return this.relatedUserService.loadUser(message.userId);
  }

  public likeMessage(message: Message) {
    if (!message.likedByUser) {
      this.messageService.likeMessage(message, this.user, this.likeButtonColor);
    } else {
      this.messageService.unlikeMessage(message, this.user, this.likeButtonColor);
    }
  }

  public messageLikedByUser(message: Message) {
    this.messageService.messageLikedByUser(message, this.user, this.likeButtonColor);
  }

  public dislikeMessage(message: Message) {
    if (!message.dislikedByUser) {
      this.messageService.dislikeMessage(message, this.user, this.dislikeButtonColor);
    } else {
      this.messageService.undislikeMessage(message, this.user, this.dislikeButtonColor);
    }
  }

  public messageDislikedByUser(message: Message) {
    this.messageService.messageDislikedByUser(message, this.user, this.dislikeButtonColor);
  }

  private messageCountView(message: Message) {
    this.messageService.countView(message);
  }

  private countComment(parentMessage: Message) {
    this.messageService.countComment(parentMessage);
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
        this.messageService.disableMessage(message, this.messageService.getSelectedMessages());
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
        this.messageService.deleteMessage(message, this.dialogRef);
      }
    });
  }

  public editMessage(message: Message) {
    const dialogRef = this.messageDialog.open(EditMessageComponent, {
      panelClass: '',
      data: { mode: message.parentId == null ? this.mode.EDIT_PUBLIC_MESSAGE : this.mode.EDIT_COMMENT, user: this.user, message: message },
      closeOnNavigation: true,
      width: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      maxWidth: '90vw',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.message) {
        this.messageService.updateMessage(data.message, this.mapService.getMapLocation(), data.user);
      }
    });
  }

  public editMessageUserProfile(message: Message) {
    if (undefined === this.selectedMessageUser.id || this.selectedMessageUser.id != message.userId) {
      this.selectedMessageUser.id = message.userId;
    }
    const dialogRef = this.dialog.open(EditUserComponent, {
      data: { relatedUser: this.selectedMessageUser },
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
      comments: [],
      commentsNumber: 0,
      status: 'enabled',
      userId: '',
      multimedia: {
        type: MultimediaType.UNDEFINED,
        url: '',
        sourceUrl: '',
        attribution: '',
        title: '',
        description: '',
        videoId: ''
      }
    };

    const dialogRef = this.messageDialog.open(EditMessageComponent, {
      panelClass: '',
      data: { mode: this.mode.ADD_COMMENT, user: this.user, message: message },
      closeOnNavigation: true,
      width: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      maxWidth: '90vw',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data.message) {
        this.messageService.createComment(data.message, this.mapService.getMapLocation(), data.user);
      }
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
          this.snackBar.open(translateResponse.error.error, '', { duration: 3000 });
        },
        complete: () => { }
      });
  }

  addMessagDialog(): void {
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
      comments: [],
      commentsNumber: 0,
      status: 'enabled',
      userId: '',
      multimedia: {
        type: MultimediaType.UNDEFINED,
        url: '',
        sourceUrl: '',
        attribution: '',
        title: '',
        description: '',
        videoId: ''
      }
    };
    const dialogRef = this.messageDialog.open(EditMessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_PUBLIC_MESSAGE, user: this.user, message: message },
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.message) {
        this.messageService.createMessage(data.message, this.mapService.getMapLocation(), data.user);
      }
    });
  }
}
