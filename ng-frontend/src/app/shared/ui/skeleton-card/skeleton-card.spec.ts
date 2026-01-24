import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkeletonCard } from './skeleton-card';

describe('SkeletonCard', () => {
  let component: SkeletonCard;
  let fixture: ComponentFixture<SkeletonCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SkeletonCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SkeletonCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
