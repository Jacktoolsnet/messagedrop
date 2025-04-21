import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-server-down',
  imports: [
    MatButtonModule
  ],
  templateUrl: './server-down.component.html',
  styleUrl: './server-down.component.css'
})
export class ServerDownComponent {
  constructor(public dialogRef: MatDialogRef<ServerDownComponent>) { }
}
