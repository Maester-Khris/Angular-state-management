import { TestBed } from '@angular/core/testing';

import { RemoteApi } from './remote-api';

describe('RemoteApi', () => {
  let service: RemoteApi;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RemoteApi);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
