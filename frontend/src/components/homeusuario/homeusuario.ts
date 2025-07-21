

import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { MascotasService } from './mascotas.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, timeout, catchError, of } from 'rxjs';

@Component({
  selector: 'app-homeusuario',
  templateUrl: './homeusuario.html',
  styleUrl: './homeusuario.css',
  standalone: true,
  imports: [CommonModule]
})
export class Homeusuario implements OnInit, OnDestroy {
  mascotas: any[] = [];
  loading = true;
  user: any = null;
  successMsg = '';
  errorMsg = '';
  private destroy$ = new Subject<void>();
  private maxRetries = 3;
  private currentRetry = 0;

  constructor(
    private mascotasService: MascotasService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.user = JSON.parse(localStorage.getItem('usuario') || 'null');
    console.log('🔍 Usuario en localStorage:', this.user); // Debug
    if (!this.user) {
      this.router.navigate(['/acceso']);
      return;
    }

    // Cargar datos inmediatamente
    this.fetchMascotasOptimized();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetchMascotasOptimized() {
    this.loading = true;
    this.currentRetry = 0;
    this.loadMascotasWithTimeout();
  }

  private loadMascotasWithTimeout() {
    console.log(`Intento ${this.currentRetry + 1} de carga de mascotas...`);

    // Obtener el ID correcto del usuario
    const userId = this.user?.id || this.user?._id;
    console.log('🆔 ID del usuario para buscar mascotas:', userId);

    if (!userId) {
      console.error('❌ No se encontró ID del usuario');
      this.loading = false;
      return;
    }

    this.mascotasService.getMascotasByOwner(userId)
      .pipe(
        timeout(5000), // Timeout de 5 segundos
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Error en la carga:', error);

          if (this.currentRetry < this.maxRetries) {
            this.currentRetry++;
            setTimeout(() => this.loadMascotasWithTimeout(), 1000);
            return of(null);
          }

          // Si fallan todos los intentos, mostrar datos vacíos
          return of([]);
        })
      )
      .subscribe({
        next: (data: any) => {
          if (data !== null) {
            console.log('Mascotas cargadas exitosamente:', data?.length || 0, 'mascotas');
            this.mascotas = (data || []).map((m: any) => ({
              ...m,
              fechaSignos: this.getCurrentDateTime(),
            }));
            this.loading = false;
            this.cdr.detectChanges(); // Forzar detección de cambios
          }
        },
        error: (err) => {
          console.error('Error final al cargar mascotas:', err);
          this.mascotas = [];
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  getCurrentDateTime(): string {
    const now = new Date();
    return now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
  }

  getGreetingMessage(): string {
    const hour = new Date().getHours();
    const userName = this.user?.nombre || 'Usuario';

    if (hour < 12) {
      return `¡Buenos días, ${userName}!`;
    } else if (hour < 18) {
      return `¡Buenas tardes, ${userName}!`;
    } else {
      return `¡Buenas noches, ${userName}!`;
    }
  }

  getGreetingEmoji(): string {
    const hour = new Date().getHours();

    if (hour < 12) {
      return '☀️';
    } else if (hour < 18) {
      return '🌤️';
    } else {
      return '🌙';
    }
  }

  getWelcomeSubtitle(): string {
    if (this.mascotas.length === 0) {
      return 'Comienza registrando tu primera mascota para monitorear sus signos vitales';
    } else if (this.mascotas.length === 1) {
      return `Aquí tienes el estado de tu mascota ${this.mascotas[0].nombre}`;
    } else {
      return `Aquí tienes el estado de tus ${this.mascotas.length} mascotas`;
    }
  }

  getPetImage(mascota: any): string {
    if (mascota.especie === 'Perro') {
      return 'assets/avatar-perro.png';
    } else if (mascota.especie === 'Gato') {
      return 'assets/avatar-gato.png';
    }
    return 'assets/toby.png'; // imagen por defecto
  }

  logout() {
    localStorage.removeItem('usuario');
    this.router.navigate(['/']);
  }

  registrarMascota() {
    this.router.navigate(['/registromascota']);
  }


  // Asociar o editar el deviceId de una mascota
  asociarDispositivo(mascota: any) {
    const nuevoDeviceId = prompt('Ingrese el nuevo ID del dispositivo para asociar:', mascota.deviceId || '');
    if (nuevoDeviceId === null) return; // Cancelado
    const body = { deviceId: nuevoDeviceId };
    this.loading = true;
    this.mascotasService.updateDeviceId(mascota._id, body).subscribe({
      next: () => {
        mascota.deviceId = nuevoDeviceId;
        this.successMsg = 'Dispositivo asociado correctamente.';
        this.loading = false;
        this.refreshData();
      },
      error: (err) => {
        this.errorMsg = err.error?.message || 'Error al asociar el dispositivo.';
        this.loading = false;
      }
    });
  }

  // Método para refrescar datos manualmente
  refreshData() {
    this.fetchMascotasOptimized();
  }

  // Método legacy mantenido para compatibilidad
  fetchMascotas() {
    this.fetchMascotasOptimized();
  }
}
