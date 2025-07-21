import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Recuperacion } from './recuperacion';

describe('Recuperacion', () => {
  let component: Recuperacion;
  let fixture: ComponentFixture<Recuperacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Recuperacion]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Recuperacion);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
