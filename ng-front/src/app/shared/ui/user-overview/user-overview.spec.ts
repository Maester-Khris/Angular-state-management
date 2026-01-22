import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserOverview } from './user-overview';

describe('UserOverview', () => {
  let component: UserOverview;
  let fixture: ComponentFixture<UserOverview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserOverview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserOverview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
