import { TestBed } from '@angular/core/testing';

import { GeoStatisticService } from './geo-statistic.service';

describe('GeoStatisticService', () => {
  let service: GeoStatisticService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GeoStatisticService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
