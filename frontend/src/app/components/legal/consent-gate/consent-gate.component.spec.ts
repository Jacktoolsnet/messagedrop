import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsentGateComponent } from './consent-gate.component';

describe('ConsentGateComponent', () => {
  let component: ConsentGateComponent;
  let fixture: ComponentFixture<ConsentGateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsentGateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsentGateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
