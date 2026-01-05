import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Poststore } from './poststore';

describe('Poststore', () => {
  let component: Poststore;
  let fixture: ComponentFixture<Poststore>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Poststore]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Poststore);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
