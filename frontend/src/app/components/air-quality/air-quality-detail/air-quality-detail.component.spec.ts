import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AirQualityDetailComponent } from './air-quality-detail.component';

describe('AirQualityDetailComponent', () => {
  let component: AirQualityDetailComponent;
  let fixture: ComponentFixture<AirQualityDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AirQualityDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AirQualityDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
