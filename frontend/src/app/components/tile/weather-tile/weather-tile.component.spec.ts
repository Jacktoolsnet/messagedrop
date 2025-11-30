import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeatherTileComponent } from './weather-tile.component';

describe('WeatherTileComponent', () => {
  let component: WeatherTileComponent;
  let fixture: ComponentFixture<WeatherTileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeatherTileComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeatherTileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
