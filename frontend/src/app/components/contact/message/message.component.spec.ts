import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactMessageComponent } from './message.component';

describe('DropmessageComponent', () => {
  let component: ContactMessageComponent;
  let fixture: ComponentFixture<ContactMessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactMessageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ContactMessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
