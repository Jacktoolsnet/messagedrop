import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { MaintenanceCardComponent } from '../shared/maintenance-card/maintenance-card.component';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [RouterLink, MatToolbarModule, MatIconModule, MatButtonModule, MaintenanceCardComponent],
  templateUrl: './maintenance.component.html',
  styleUrl: './maintenance.component.css'
})
export class MaintenanceComponent {}
