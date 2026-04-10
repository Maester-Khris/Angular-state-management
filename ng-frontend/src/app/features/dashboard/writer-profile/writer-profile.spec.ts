import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WriterProfile } from './writer-profile';

describe('WriterProfile', () => {
  let component: WriterProfile;
  let fixture: ComponentFixture<WriterProfile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WriterProfile]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WriterProfile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
