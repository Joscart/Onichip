import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Homeadmin } from './homeadmin';

describe('Homeadmin', () => {
  let component: Homeadmin;
  let fixture: ComponentFixture<Homeadmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Homeadmin]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Homeadmin);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
