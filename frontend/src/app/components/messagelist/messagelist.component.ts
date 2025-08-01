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
import { MessageProfileComponent } from './message-profile/message-profile.component';

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
  readonly filteredMessagesSignal = computed(() => {
    return this.messageService.messagesSignal();
  });
  readonly selectedMessagesSignal = this.messageService.selectedMessagesSignal;
  readonly commentsSignal = computed(() => {
    const parentMessage = this.messageService.selectedMessagesSignal().at(-1);
    return parentMessage ? this.messageService.getCommentsSignalForMessage(parentMessage.uuid)() : [];
  });

  readonly currentParentSignal = computed(() =>
    this.messageService.selectedMessagesSignal().at(-1)
  );

  readonly commentCountsSignal = this.messageService.commentCountsSignal;
  readonly commentCountForMessage = (uuid: string) => computed(() =>
    this.commentCountsSignal()[uuid] || 0
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

  getCommentBadge(uuid: string): number {
    const count = this.commentCountForMessage(uuid)() ?? 0;
    return count;
  }

  public goBack() {
    const selected = this.messageService.selectedMessagesSignal();
    if (selected.length > 1) {
      const newSelected = [...selected];
      newSelected.pop();

      // Hier: Parent aus dem Signal neu holen → damit counts aktuell sind
      const parent = newSelected.at(-1);
      if (parent) {
        const updatedParent = this.findMessageInSignals(parent.uuid) || parent;
        newSelected[newSelected.length - 1] = updatedParent;
      }

      this.messageService.selectedMessagesSignal.set(newSelected);
    } else if (selected.length === 1) {
      this.messageService.selectedMessagesSignal.set([]);
    } else {
      this.dialogRef.close();
    }
  }

  private findMessageInSignals(uuid: string): Message | undefined {
    return (
      this.messageService.messagesSignal().find(m => m.uuid === uuid) ||
      Array.from(this.messageService.commentsSignals.values())
        .flatMap(signal => signal())
        .find(m => m.uuid === uuid)
    );
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

      // 2. Prüfen, ob in der aktuellen Ebene noch Comments da sind
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

    dialogRef.afterClosed().subscribe(() => {
      this.messageService.updateMessage(message);
    });
  }

  public editMessageUserProfile(message: Message) {

    let profile: Profile | undefined = this.profileService.getProfile(message.userId);

    if (!profile) {
      profile = { name: '', base64Avatar: '', defaultStyle: '' };
    }

    const dialogRef = this.dialog.open(MessageProfileComponent, {
      data: { profile, userId: message.userId },
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (profile) {
        this.profileService.setProfile(message.userId, profile);
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
      }
    });
  }

  public handleCommentClick(message: Message) {
    const commentsSignal = this.messageService.getCommentsSignalForMessage(message.uuid);
    const comments = commentsSignal();

    // Falls noch keine Kommentare geladen → jetzt holen
    this.messageService.getCommentsForParentMessage(message);

    // Immer die aktuelle Ebene (die Kinder) als neue Ebene im Stack speichern
    this.messageService.selectedMessagesSignal.set([...this.messageService.selectedMessagesSignal(), message]);

    // Sonderfall: Noch keine Comments → Direkt einen Kommentar erstellen
    if (comments.length === 0 && message.commentsNumber === 0) {
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