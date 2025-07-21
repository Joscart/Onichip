import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Homeusuario } from './homeusuario';

describe('Homeusuario', () => {
  let component: Homeusuario;
  let fixture: ComponentFixture<Homeusuario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Homeusuario]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Homeusuario);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
