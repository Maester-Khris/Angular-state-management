import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WriterConsole } from './writer-console';

describe('WriterConsole', () => {
  let component: WriterConsole;
  let fixture: ComponentFixture<WriterConsole>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WriterConsole]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WriterConsole);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
