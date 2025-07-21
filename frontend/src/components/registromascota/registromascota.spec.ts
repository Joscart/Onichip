import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Registromascota } from './registromascota';

describe('Registromascota', () => {
  let component: Registromascota;
  let fixture: ComponentFixture<Registromascota>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Registromascota]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Registromascota);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
