import { TestBed } from '@angular/core/testing';

import { SharedContentService } from './shared-content.service';

describe('SharedContentService', () => {
  let service: SharedContentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SharedContentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
