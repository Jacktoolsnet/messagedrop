import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactEditMessageComponent } from './contact-edit-message.component';

describe('DropmessageComponent', () => {
  let component: ContactEditMessageComponent;
  let fixture: ComponentFixture<ContactEditMessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactEditMessageComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ContactEditMessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
