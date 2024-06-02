import { TestBed } from '@angular/core/testing';

import { RelatedUserService } from './related-user.service';

describe('RelatedUserService', () => {
  let service: RelatedUserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RelatedUserService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
