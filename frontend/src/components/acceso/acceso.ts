


import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../app/services/auth.service';

@Component({
  selector: 'app-acceso',
  templateUrl: './acceso.html',
  styleUrl: './acceso.css',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule]
})
export class Acceso {
  loginForm: FormGroup;
  loading = false;
  errorMsg = '';

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  login() {
    if (this.loginForm.invalid) {
      this.errorMsg = 'Por favor, complete todos los campos correctamente.';
      return;
    }
    this.loading = true;
    this.errorMsg = '';
    const { email, password } = this.loginForm.value;
    this.auth.login(email, password).subscribe({
      next: (res) => {
        // Guardar usuario o admin según respuesta
        if (res.usuario) {
          localStorage.setItem('usuario', JSON.stringify(res.usuario));
          this.router.navigate(['/homeusuario']);
        } else if (res.admin) {
          localStorage.setItem('adminSession', JSON.stringify(res.admin));
          this.router.navigate(['/admin']);
        }
        this.loading = false;
      },
      error: (err) => {
        this.errorMsg = err.error?.message || 'Credenciales incorrectas o error de servidor.';
        this.loading = false;
      }
    });
  }

  irARecuperacion() {
    this.router.navigate(['/recuperacion']);
  }

  irARegistro() {
    this.router.navigate(['/registro']);
  }

  irAAdmin() {
    this.router.navigate(['/admin']);
  }

  irAInicio() {
    this.router.navigate(['/']);
  }
}
