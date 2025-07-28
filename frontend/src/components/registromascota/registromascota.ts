

import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-registromascota',
  templateUrl: './registromascota.html',
  styleUrl: './registromascota.css',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule]
})
export class Registromascota {
  mascotaForm: FormGroup;
  loading = false;
  errorMsg = '';
  successMsg = '';
  user: any = null;

  especies = ['Perro', 'Gato', 'Otro'];

  constructor(private fb: FormBuilder, private http: HttpClient, private router: Router) {
    this.mascotaForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      especie: ['', Validators.required],
      raza: ['', [Validators.required, Validators.minLength(2)]],
      edad: ['', [Validators.required, Validators.min(0), Validators.max(40)]],
      deviceId: [''] // Opcional
    });
  }

  ngOnInit() {
    this.user = JSON.parse(localStorage.getItem('usuario') || 'null');
    console.log('🔍 Usuario en localStorage (registro mascota):', this.user); // Debug
    if (!this.user) {
      this.router.navigate(['/acceso']);
    }
  }

  registrarMascota() {
    if (this.mascotaForm.invalid) {
      this.errorMsg = 'Por favor, complete todos los campos correctamente.';
      return;
    }

    // Obtener el ID correcto del usuario
    const userId = this.user?.id || this.user?._id;
    console.log('🆔 ID del usuario para mascota:', userId);

    if (!userId) {
      this.errorMsg = 'Error: No se encontró el ID del usuario.';
      return;
    }

    this.loading = true;
    this.errorMsg = '';
    this.successMsg = '';
    
    // Generar deviceId único si no se proporciona
    const formValue = this.mascotaForm.value;
    const deviceId = formValue.deviceId || `ONICHIP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    const mascota: any = {
      ...formValue,
      propietario: userId,
      deviceId: deviceId,
      dispositivo: {
        id: deviceId,
        tipo: 'chip',
        version: '1.0'
      }
    };
    
    console.log('📝 Registrando mascota:', mascota);

    this.http.post<any>('http://localhost:3000/api/device', mascota).subscribe({
      next: () => {
        this.successMsg = '¡Mascota registrada exitosamente!';
        this.loading = false;
        setTimeout(() => this.router.navigate(['/homeusuario']), 1200);
      },
      error: (err) => {
        this.errorMsg = err.error?.message || 'Error al registrar la mascota.';
        this.loading = false;
      }
    });
  }

  volverAlDashboard() {
    this.router.navigate(['/homeusuario']);
  }
}
