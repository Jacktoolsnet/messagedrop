import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResetUserComponent } from './reset-user.component';

describe('ResetUserComponent', () => {
  let component: ResetUserComponent;
  let fixture: ComponentFixture<ResetUserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetUserComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResetUserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
