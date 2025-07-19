import { Component } from '@angular/core';
import { ApiService } from '../../api.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  credentials = { apodo: '', password: '' };
  error = '';

  constructor(private api: ApiService, private router: Router) {}

  onLogin() {
    this.error = '';
    this.api.login(this.credentials).subscribe({
      next: res => {
        localStorage.setItem('token', res.token || 'true');
        localStorage.setItem('user', JSON.stringify(res.user));
        this.router.navigate(['/']);
      },
      error: err => {
        this.error = err.error?.error || 'Credenciales incorrectas';
      }
    });
  }
}
