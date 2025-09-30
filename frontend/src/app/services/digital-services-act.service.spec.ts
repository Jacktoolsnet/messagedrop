import { TestBed } from '@angular/core/testing';

import { DigitalServicesActService } from './digital-services-act.service';

describe('DigitalServicesActService', () => {
  let service: DigitalServicesActService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DigitalServicesActService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
