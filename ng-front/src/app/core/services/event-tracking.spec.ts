import { TestBed } from '@angular/core/testing';

import { EventTracking } from './event-tracking';

describe('EventTracking', () => {
  let service: EventTracking;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EventTracking);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
