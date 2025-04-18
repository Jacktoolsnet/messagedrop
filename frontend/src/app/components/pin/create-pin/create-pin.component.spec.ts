import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreatePinComponent } from './create-pin.component';

describe('CreatepinComponent', () => {
  let component: CreatePinComponent;
  let fixture: ComponentFixture<CreatePinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreatePinComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(CreatePinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
