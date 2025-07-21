import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessageProfileComponent } from './message-profile.component';

describe('EditUserComponent', () => {
  let component: MessageProfileComponent;
  let fixture: ComponentFixture<MessageProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageProfileComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(MessageProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
