

import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../app/services/auth.service';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.html',
  styleUrl: './registro.css',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class Registro {
  registroForm: FormGroup;
  loading = false;
  errorMsg = '';
  successMsg = '';

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.registroForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  registrar() {
    if (this.registroForm.invalid) {
      this.errorMsg = 'Por favor, complete todos los campos correctamente.';
      return;
    }
    this.loading = true;
    this.errorMsg = '';
    this.successMsg = '';
    const { nombre, email, password } = this.registroForm.value;
    this.auth.register(nombre, email, password).subscribe({
      next: (response) => {
        this.successMsg = '¡Registro exitoso! Ahora puedes iniciar sesión.';
        this.loading = false;
        setTimeout(() => this.router.navigate(['/acceso']), 1200);
      },
      error: (err) => {
        this.errorMsg = err.error?.message || 'Error al registrar. Intenta nuevamente.';
        this.loading = false;
      }
    });
  }

  irAInicio() {
    this.router.navigate(['/']);
  }
}
