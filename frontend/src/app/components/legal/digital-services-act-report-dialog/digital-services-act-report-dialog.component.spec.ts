import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DigitalServicesActReportDialogComponent } from './digital-services-act-report-dialog.component';

describe('DigitalServicesActReportDialogComponent', () => {
  let component: DigitalServicesActReportDialogComponent;
  let fixture: ComponentFixture<DigitalServicesActReportDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DigitalServicesActReportDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DigitalServicesActReportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
