import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileConfirmRequestComponent } from './profile-confirm-request.component';

describe('DeleteUserComponent', () => {
  let component: ProfileConfirmRequestComponent;
  let fixture: ComponentFixture<ProfileConfirmRequestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileConfirmRequestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfileConfirmRequestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
