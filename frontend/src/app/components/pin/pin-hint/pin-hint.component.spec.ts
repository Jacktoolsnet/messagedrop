import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PinHintComponent } from './pin-hint.component';

describe('PinHintComponent', () => {
  let component: PinHintComponent;
  let fixture: ComponentFixture<PinHintComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PinHintComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PinHintComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
