import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Multimedia } from '../../interfaces/multimedia';

@Component({
  selector: 'app-showmultimedia',
  imports: [CommonModule],
  templateUrl: './showmultimedia.component.html',
  styleUrl: './showmultimedia.component.css'
})
export class ShowmultimediaComponent {
  @Input() multimedia: Multimedia | undefined;
}
