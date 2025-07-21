import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Acceso } from './acceso';

describe('Acceso', () => {
  let component: Acceso;
  let fixture: ComponentFixture<Acceso>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Acceso]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Acceso);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
