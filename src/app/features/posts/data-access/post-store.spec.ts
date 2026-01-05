import { TestBed } from '@angular/core/testing';
import { PostStore } from './post-store';


describe('PostStore', () => {
  let service: PostStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PostStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
