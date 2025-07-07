import { CommonModule } from '@angular/common';
import { Component, computed, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Location } from '../../interfaces/location';
import { Message } from '../../interfaces/message';
import { Mode } from '../../interfaces/mode';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { Profile } from '../../interfaces/profile';
import { User } from '../../interfaces/user';
import { ShortNumberPipe } from '../../pipes/short-number.pipe';
import { MapService } from '../../services/map.service';
import { MessageService } from '../../services/message.service';
import { ProfileService } from '../../services/profile.service';
import { SharedContentService } from '../../services/shared-content.service';
import { TranslateService } from '../../services/translate.service';
import { UserService } from '../../services/user.service';
import { EditMessageComponent } from '../editmessage/edit-message.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { ShowmessageComponent } from '../showmessage/showmessage.component';
import { BlockMessageComponent } from './block-message/block-message.component';
import { DeleteMessageComponent } from './delete-message/delete-message.component';
import { EditProfileComponent } from './edit-profile/edit-profile.component';

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
    MatFormFieldModule,
    MatMenuModule,
    MatInputModule
  ],
  templateUrl: './messagelist.component.html',
  styleUrl: './messagelist.component.css'
})
export class MessagelistComponent implements OnInit {

  readonly messagesSignal = this.messageService.messagesSignal;
  readonly filteredMessagesSignal = computed(() =>
    !this.data.messages || this.data.messages.length === 0
      ? this.messageService.messagesSignal()
      : this.messageService.messagesSignal().filter(msg =>
        this.data.messages.some(message => message.id === msg.id)
      )
  );
  readonly selectedMessagesSignal = this.messageService.selectedMessagesSignal;
  readonly commentsSignal = computed(() => {
    const parentMessage = this.messageService.selectedMessagesSignal().at(-1);
    return parentMessage ? this.messageService.getCommentsSignalForMessage(parentMessage.uuid)() : [];
  });

  readonly currentParentSignal = computed(() =>
    this.messageService.selectedMessagesSignal().at(-1)
  );

  public user: User;
  public userProfile: Profile;
  public likeButtonColor: string = 'secondary';
  public dislikeButtonColor: string = 'secondary';
  public mode: typeof Mode = Mode;

  constructor(
    public userService: UserService,
    public messageService: MessageService,
    private translateService: TranslateService,
    private mapService: MapService,
    public profileService: ProfileService,
    private sharedContentService: SharedContentService,
    public dialogRef: MatDialogRef<any>,
    public messageDialog: MatDialog,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: { messages: Message[], location: Location }
  ) {
    this.user = this.userService.getUser();
    this.userProfile = this.userService.getProfile();
  }

  async ngOnInit() {
    await this.profileService.loadAllProfiles();
  }

  public goBack() {
    const selected = this.messageService.selectedMessagesSignal();
    if (selected.length > 1) {
      // Eine Ebene zurück
      const newSelected = [...selected];
      newSelected.pop();
      this.messageService.selectedMessagesSignal.set(newSelected);

      // Parent wieder sichtbar machen
      setTimeout(() => {
        const parent = newSelected.at(-1);
        if (parent) {
          const element = document.getElementById(`message-${parent.id}`);
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    } else if (selected.length === 1) {
      // Root-Ebene → Stack leeren
      this.messageService.selectedMessagesSignal.set([]);
    } else {
      // Nichts mehr ausgewählt → Dialog schließen
      this.dialogRef.close();
    }
  }

  public flyTo(message: Message) {
    this.mapService.moveToWithZoom(message.location, 18);
    this.mapService.setDrawCircleMarker(true);
    this.mapService.setCircleMarker(message.location);
    this.dialogRef.close();
  }

  public navigateToMessageLocation(message: Message) {
    this.messageService.navigateToMessageLocation(message);
  }

  public likeMessage(message: Message) {
    if (!message.likedByUser) {
      this.messageService.likeMessage(message, this.user);
    } else {
      this.messageService.unlikeMessage(message, this.user);
    }
  }

  public dislikeMessage(message: Message) {
    if (!message.dislikedByUser) {
      this.messageService.dislikeMessage(message, this.user);
    } else {
      this.messageService.undislikeMessage(message, this.user);
    }
  }

  public disableMessage(message: Message) {
    const dialogRef = this.dialog.open(BlockMessageComponent, {
      closeOnNavigation: true,
      hasBackdrop: true
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.messageService.disableMessage(message);
      }
    });
  }

  public deleteMessage(message: Message) {
    const dialogRef = this.dialog.open(DeleteMessageComponent, {
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      const selected = this.messageService.selectedMessagesSignal();

      // 1. Löschen
      this.messageService.deleteMessage(message);

      // 2. Parent in selectedMessagesSignal runterzählen
      this.messageService.selectedMessagesSignal.update(selected =>
        selected.map(m =>
          m.uuid === message.parentUuid
            ? { ...m, commentsNumber: Math.max(m.commentsNumber - 1, 0) }
            : m
        )
      );

      // 3. Parent in messagesSignal runterzählen
      this.messageService.messagesSignal.update(messages =>
        messages.map(m =>
          m.uuid === message.parentUuid
            ? { ...m, commentsNumber: Math.max(m.commentsNumber - 1, 0) }
            : m
        )
      );

      // 4. Prüfen, ob in der aktuellen Ebene noch Comments da sind
      const parentUuid = message.parentUuid;
      if (!parentUuid) return; // Root → nichts zu tun

      const commentsSignal = this.messageService.getCommentsSignalForMessage(parentUuid);
      const remainingComments = commentsSignal().filter(c => c.id !== message.id);

      if (remainingComments.length === 0) {
        // Eine Ebene zurückgehen
        const newSelected = [...selected];
        newSelected.pop();
        this.messageService.selectedMessagesSignal.set(newSelected);
      }
    });
  }

  public editMessage(message: Message) {
    const oriMessage = message.message;
    const oriMultimedia = JSON.parse(JSON.stringify(message.multimedia));
    const oriStyle = message.style;

    if (message.multimedia.type !== MultimediaType.UNDEFINED) {
      this.sharedContentService.addSharedContentToMessage(message);
    }

    const dialogRef = this.messageDialog.open(EditMessageComponent, {
      panelClass: '',
      data: { mode: message.parentId == null ? this.mode.EDIT_PUBLIC_MESSAGE : this.mode.EDIT_COMMENT, message },
      closeOnNavigation: true,
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (data?.message) {
        this.messageService.updateMessage(data.message);
      } else {
        message.message = oriMessage;
        message.multimedia = oriMultimedia;
        message.style = oriStyle;
      }
    });
  }

  public editMessageUserProfile(message: Message) {
    if (!this.userService.isReady()) return;
    const profile = this.profileService.getProfile(message.userId);
    if (!profile) return;

    const oriName = profile.name;
    const oriBase64Avatar = profile.base64Avatar;
    const oriDefaultStyle = profile.defaultStyle;

    const dialogRef = this.dialog.open(EditProfileComponent, {
      data: { profile, userId: message.userId },
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.profileService.setProfile(result.userId, result.profile);
      } else {
        profile.name = oriName;
        profile.base64Avatar = oriBase64Avatar;
        profile.defaultStyle = oriDefaultStyle;
      }
    });
  }

  public translateMessage(message: Message) {
    this.translateService.translate(message.message, this.user.language).subscribe({
      next: response => {
        if (response.status === 200) {
          message.translatedMessage = response.result?.text;
        }
      },
      error: err => {
        this.snackBar.open(err.error.error, '', { duration: 3000 });
      }
    });
  }

  addMessagDialog(): void {
    const message: Message = {
      id: 0,
      uuid: crypto.randomUUID(),
      parentId: 0,
      parentUuid: '',
      typ: 'public',
      createDateTime: '',
      deleteDateTime: '',
      location: this.data.location,
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
        contentId: ''
      }
    };

    this.sharedContentService.addSharedContentToMessage(message);

    const dialogRef = this.messageDialog.open(EditMessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_PUBLIC_MESSAGE, message },
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (data?.message) {
        this.messageService.createMessage(data.message, this.user);
        this.data.messages.push(data.message);
      }
    });
  }

  public handleCommentClick(message: Message) {
    const currentSelected = this.messageService.selectedMessagesSignal();
    const commentsSignal = this.messageService.getCommentsSignalForMessage(message.uuid);

    // Gibt es bereits geladene Comments ODER zeigt der Counter, dass es Comments gibt?
    if (commentsSignal().length > 0 || message.commentsNumber > 0) {
      // → Neue Ebene im Stack hinzufügen
      this.messageService.selectedMessagesSignal.set([...currentSelected, message]);

      // → Nur laden, wenn noch nicht im Signal
      if (commentsSignal().length === 0) {
        this.messageService.getCommentsForParentMessage(message);
      }
    } else {
      // Noch keine Comments → Erstellt einen neuen Comment
      if (this.userService.isReady()) {
        this.addComment(message);
      }
    }
  }

  public addComment(parentMessage: Message) {
    const message: Message = {
      id: 0,
      uuid: crypto.randomUUID(),
      parentId: parentMessage.id,
      parentUuid: parentMessage.uuid,
      typ: 'public',
      createDateTime: '',
      deleteDateTime: '',
      location: parentMessage.location,
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
        contentId: ''
      }
    };

    this.sharedContentService.addSharedContentToMessage(message);

    const dialogRef = this.messageDialog.open(EditMessageComponent, {
      panelClass: '',
      data: { mode: this.mode.ADD_COMMENT, message },
      closeOnNavigation: true,
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (data?.message) {
        this.messageService.createComment(data.message, this.userService.getUser());
      }
    });
  }
}