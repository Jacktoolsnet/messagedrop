import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-server-down',
  imports: [
    CommonModule,
    MatButtonModule
  ],
  templateUrl: './server-down.component.html',
  styleUrl: './server-down.component.css'
})
export class ServerDownComponent implements OnInit {
  public showRetry = false;

  constructor(public dialogRef: MatDialogRef<ServerDownComponent>) { }

  ngOnInit(): void {
    setTimeout(() => {
      this.showRetry = true;
    }, 10000);
  }
}
