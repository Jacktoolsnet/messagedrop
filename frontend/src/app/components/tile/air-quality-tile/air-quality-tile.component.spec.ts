import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AirQualityTileComponent } from './air-quality-tile.component';

describe('AirQualityTileComponent', () => {
  let component: AirQualityTileComponent;
  let fixture: ComponentFixture<AirQualityTileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AirQualityTileComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AirQualityTileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
