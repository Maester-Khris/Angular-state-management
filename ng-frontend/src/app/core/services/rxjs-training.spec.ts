import { TestBed } from '@angular/core/testing';

import { RxjsTraining } from './rxjs-training';

describe('RxjsTraining', () => {
  let service: RxjsTraining;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RxjsTraining);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
