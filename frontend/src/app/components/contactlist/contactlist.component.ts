import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MatDialog, MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContainer, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Animation } from '../../interfaces/animation';
import { Contact } from '../../interfaces/contact';
import { Mode } from '../../interfaces/mode';
import { User } from '../../interfaces/user';
import { StyleService } from '../../services/style.service';
import { PlacelistComponent } from '../placelist/placelist.component';
import { CommonModule } from '@angular/common';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ContactComponent } from '../contact/contact.component';
import { ConnectService } from '../../services/connect.service';
import { UserService } from '../../services/user.service';
import { Buffer } from 'buffer';

@Component({
  selector: 'app-contactlist',
  standalone: true,
  imports: [
    MatBadgeModule,
    MatCardModule,
    MatDialogContainer,
    CommonModule,
    MatButtonModule, 
    MatDialogActions, 
    MatDialogClose, 
    MatDialogTitle, 
    MatDialogContent, 
    MatIcon, 
    MatMenuModule,
  ],
  templateUrl: './contactlist.component.html',
  styleUrl: './contactlist.component.css'
})
export class ContactlistComponent implements OnInit {
  public contacts!: Contact[];
  private contactToDelete!: Contact
  public user!: User;
  public animation!: Animation;
  public mode: typeof Mode = Mode;
  private snackBarRef: any;
  public subscriptionError: boolean = false;

  constructor(
    private connectService: ConnectService,
    private userService: UserService,
    public dialogRef: MatDialogRef<PlacelistComponent>,
    public contactDialog: MatDialog,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: {user: User, contacts: Contact[]}
  ) {
    this.user = data.user;
    this.contacts = data.contacts;
  }

  ngOnInit(): void {
    this.animation = this.style.getRandomColorAnimation();
  }

  openContactDialog(): void {
    let contact: Contact = {
      id: "",
      connectId: "",
      userId: this.user.id,
      name: ''
    };
    const dialogRef = this.contactDialog.open(ContactComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {mode: this.mode.ADD_PLACE, contact: contact},
      width: '90vw',
      minWidth: '20vw',
      maxWidth:'90vw',
      minHeight: 'auto',
      height: 'auto',
      maxHeight: '90vh',
      hasBackdrop: true      
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.contact) {
        this.connectService.getById(data.contact.connectId)
            .subscribe({
              next: getConnectResponse => {
                if (getConnectResponse.status === 200) {
                  let buffer = Buffer.from(JSON.parse(getConnectResponse.connect.signature))
                  var signature = buffer.buffer.slice(
                    buffer.byteOffset, buffer.byteOffset + buffer.byteLength
                  )
                  data.contact.id = "??? Not implemented yet";
                  data.contact.userId = getConnectResponse.connect.userId;
                  data.contact.encryptionPublicKey = JSON.parse(getConnectResponse.connect.encryptionPublicKey);
                  data.contact.signingPublicKey = JSON.parse(getConnectResponse.connect.signingPublicKey);
                  data.contact.signature =  signature;
                  // Verify data
                  this.userService.verifySignature(data.contact.userId, data.contact.signingPublicKey, data.contact.signature)
                  .then((valid: Boolean) => {
                    console.log("valid:" + valid);
                    if (valid) {
                      this.snackBarRef = this.snackBar.open(`Connect data is valid.`, 'OK');
                      // Generate Id
                      
                      // Delete connect record

                      this.contacts.unshift(data.contact);
                      this.snackBarRef = this.snackBar.open(`Contact succesfully created.`, '', {duration: 1000});
                    } else {
                      this.snackBarRef = this.snackBar.open(`Connect data is invalid.`, 'OK');
                    }
                  });
                }
              },
              error: (err) => {this.snackBarRef = this.snackBar.open(err.message, 'OK');},
              complete:() => {}
            });   
      }
    });
  }

  public deleteContact(contact: Contact) {
    /*
    this.contactToDelete = contact;
    const dialogRef = this.dialog.open(DeletePlaceComponent, {
      closeOnNavigation: true,
      hasBackdrop: true 
    });

    dialogRef.afterOpened().subscribe(e => {      
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && undefined != this.contactToDelete) {
        this.contactService.deletePlace(this.contactToDelete)
              .subscribe({
                next: (simpleStatusResponse) => {
                  if (simpleStatusResponse.status === 200) {
                    this.contacts.splice(this.contacts.findIndex(contact => contact.id !== this.contactToDelete.id), 1);                    
                  }
                },
                error: (err) => {
                },
                complete:() => {}
              });
      }
    });
    */
  }

  public editContact(contact: Contact) {
    /*
    const dialogRef = this.placeDialog.open(PlaceComponent, {
      panelClass: '',
      data: {mode: this.mode.EDIT_PLACE, user: this.user, place: place},
      closeOnNavigation: true,
      width: '90vw',
      minWidth: '20vw',
      maxWidth:'90vw',
      minHeight: 'auto',
      height: 'auto',
      maxHeight: '90vh',
      hasBackdrop: true      
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.place) {
        this.contactService.updateContact(data.place)
            .subscribe({
              next: simpleResponse => {
                if (simpleResponse.status === 200) {
                  this.snackBarRef = this.snackBar.open(`Place succesfully edited.`, '', {duration: 1000});
                }
              },
              error: (err) => {this.snackBarRef = this.snackBar.open(err.message, 'OK');},
              complete:() => {}
            });
      }
    });
    */
  }

  public goBack() {
    this.dialogRef.close();
  }
}
