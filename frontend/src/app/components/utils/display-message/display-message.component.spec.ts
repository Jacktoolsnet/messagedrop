import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DisplayMessage } from './display-message.component';

describe('ServerErrorComponent', () => {
  let component: DisplayMessage;
  let fixture: ComponentFixture<DisplayMessage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisplayMessage]
    })
      .compileComponents();

    fixture = TestBed.createComponent(DisplayMessage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
