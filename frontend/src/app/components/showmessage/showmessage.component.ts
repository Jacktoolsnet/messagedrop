import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-showmessage',
  imports: [],
  templateUrl: './showmessage.component.html',
  styleUrl: './showmessage.component.css'
})
export class ShowmessageComponent {
  @Input() message: string | undefined;
  @Input() style: string | undefined;
}
