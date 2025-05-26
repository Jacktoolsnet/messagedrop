import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeoStatisticComponent } from './geo-statistic.component';

describe('GeoStatisticComponent', () => {
  let component: GeoStatisticComponent;
  let fixture: ComponentFixture<GeoStatisticComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeoStatisticComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GeoStatisticComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
