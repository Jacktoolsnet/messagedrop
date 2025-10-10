import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuditTimelineComponent } from './audit-timeline.component';

describe('AuditTimelineComponent', () => {
  let component: AuditTimelineComponent;
  let fixture: ComponentFixture<AuditTimelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditTimelineComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuditTimelineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
