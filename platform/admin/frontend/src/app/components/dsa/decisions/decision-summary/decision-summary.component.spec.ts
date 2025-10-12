import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DecisionSummaryComponent } from './decision-summary.component';

describe('DecisionSummaryComponent', () => {
  let component: DecisionSummaryComponent;
  let fixture: ComponentFixture<DecisionSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DecisionSummaryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DecisionSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
