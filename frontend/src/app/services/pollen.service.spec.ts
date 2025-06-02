import { TestBed } from '@angular/core/testing';

import { PollenService } from './pollen.service';

describe('PollenService', () => {
  let service: PollenService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PollenService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
