import { TestBed } from '@angular/core/testing';

import { TenorService } from './tenor.service';

describe('TenorService', () => {
  let service: TenorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TenorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
