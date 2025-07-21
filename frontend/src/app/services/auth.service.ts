import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  // Validar si existe un email en la base de datos
  validarEmail(email: string): Observable<any> {
    console.log('📨 AuthService: Enviando email para validar:', email);
    const request = this.http.post(`${this.apiUrl}/validar-email`, { email });
    console.log('📨 AuthService: Request creado:', request);
    return request;
  }

  // Actualizar contraseña
  actualizarContrasena(email: string, nuevaContrasena: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/actualizar-contrasena`, {
      email,
      nuevaContrasena
    });
  }

  // Login de usuario o admin
  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { email, password });
  }

  // Registro de usuario o primer admin (superadmin)
  register(nombre: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, { nombre, email, password });
  }

  // Crear admin (solo superadmin)
  createAdmin(superAdminEmail: string, superAdminPassword: string, nombre: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/create`, { superAdminEmail, superAdminPassword, nombre, email, password });
  }
}
