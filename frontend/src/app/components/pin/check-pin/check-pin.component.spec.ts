import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CheckPinComponent } from './check-pin.component';

describe('CheckPinComponent', () => {
  let component: CheckPinComponent;
  let fixture: ComponentFixture<CheckPinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckPinComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CheckPinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
