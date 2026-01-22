import { TestBed } from '@angular/core/testing';

import { MockApi } from './mock-api';

describe('MockApi', () => {
  let service: MockApi;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MockApi);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
