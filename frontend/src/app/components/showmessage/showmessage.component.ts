import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-showmessage',
  imports: [],
  templateUrl: './showmessage.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './showmessage.component.css'
})
export class ShowmessageComponent {
  @Input() message: string | undefined;
  @Input() style: string | undefined;
}
