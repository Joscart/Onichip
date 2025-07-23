

import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { MascotasService } from './mascotas.service';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { Subject, takeUntil, timeout, catchError, of } from 'rxjs';

@Component({
  selector: 'app-homeusuario',
  templateUrl: './homeusuario.html',
  styleUrl: './homeusuario.css',
  standalone: true,
  imports: [CommonModule, DatePipe]
})
export class Homeusuario implements OnInit, OnDestroy {
  mascotas: any[] = [];
  loading = true;
  user: any = null;
  successMsg = '';
  errorMsg = '';
  
  // Estados del mapa
  showMapModal = false;
  selectedMascota: any = null;
  
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
    console.log('🔍 Usuario en localStorage:', this.user);
    if (!this.user) {
      this.router.navigate(['/acceso']);
      return;
    }

    // Cargar datos de mascotas con información GPS
    this.fetchMascotasOptimized();
    
    // Configurar actualización automática cada 30 segundos
    this.setupAutoRefresh();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // 🔄 CONFIGURAR ACTUALIZACIÓN AUTOMÁTICA
  setupAutoRefresh() {
    setInterval(() => {
      if (!this.showMapModal) { // Solo actualizar si no hay modal abierto
        this.refreshLocationData();
      }
    }, 30000); // 30 segundos
  }

  // 🔄 ACTUALIZAR DATOS DE UBICACIÓN (simulado por ahora)
  refreshLocationData() {
    // Por ahora simular datos GPS hasta que el servicio esté funcionando
    this.mascotas.forEach(mascota => {
      if (mascota._id) {
        // Simular datos GPS aleatorios para demo
        mascota.ubicacionActual = {
          latitude: 19.4326 + (Math.random() - 0.5) * 0.01,
          longitude: -99.1332 + (Math.random() - 0.5) * 0.01,
          accuracy: Math.floor(Math.random() * 10) + 5,
          speed: Math.floor(Math.random() * 20),
          method: Math.random() > 0.7 ? 'WiFi' : 'GPS',
          timestamp: new Date().toISOString()
        };
        
        if (!mascota.dispositivo) {
          mascota.dispositivo = {};
        }
        mascota.dispositivo.bateria = {
          nivel: Math.floor(Math.random() * 100) + 1,
          cargando: Math.random() > 0.8
        };
        
        this.cdr.detectChanges();
      }
    });
  }

  // 📊 CARGAR DATOS DE MASCOTAS
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

  // 📍 MÉTODOS ESPECÍFICOS PARA GPS

  // Obtener estado de la ubicación
  getLocationStatus(mascota: any): string {
    if (!mascota.ubicacionActual) return 'offline';
    
    const lastUpdate = new Date(mascota.ubicacionActual.timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    
    if (diffMinutes < 5) return 'online';
    if (diffMinutes < 30) return 'warning';
    return 'offline';
  }

  // Obtener icono según el tipo de mascota
  getPetTypeIcon(tipo: string): string {
    switch (tipo?.toLowerCase()) {
      case 'perro': return '🐕';
      case 'gato': return '🐱';
      case 'conejo': return '🐰';
      case 'hamster': return '🐹';
      default: return '🐾';
    }
  }

  // Obtener última actualización formateada
  getLastLocationUpdate(mascota: any): string {
    if (!mascota.ubicacionActual?.timestamp) {
      return 'Sin datos';
    }
    
    const lastUpdate = new Date(mascota.ubicacionActual.timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    
    if (diffMinutes < 1) return 'Ahora mismo';
    if (diffMinutes < 60) return `Hace ${Math.floor(diffMinutes)} min`;
    if (diffMinutes < 1440) return `Hace ${Math.floor(diffMinutes / 60)} h`;
    return lastUpdate.toLocaleDateString();
  }

  // 🗺️ MÉTODOS DEL MODAL DE MAPA

  verMapa(mascota: any) {
    this.selectedMascota = mascota;
    this.showMapModal = true;
  }

  closeMapModal() {
    this.showMapModal = false;
    this.selectedMascota = null;
  }

  verHistorial(mascota: any) {
    // TODO: Implementar vista de historial GPS
    console.log('Ver historial de:', mascota.nombre);
    alert(`Historial GPS de ${mascota.nombre} - Próximamente disponible`);
  }

  configurarGeofences(mascota: any) {
    // TODO: Implementar configuración de geofences
    console.log('Configurar geofences para:', mascota.nombre);
    alert(`Configuración de geofences para ${mascota.nombre} - Próximamente disponible`);
  }

  getPetImage(mascota: any): string {
    if (mascota.especie === 'Perro' || mascota.tipo === 'Perro') {
      return 'assets/avatar-perro.png';
    } else if (mascota.especie === 'Gato' || mascota.tipo === 'Gato') {
      return 'assets/avatar-gato.png';
    }
    return 'assets/toby.png';
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
    const nuevoDeviceId = prompt('Ingrese el nuevo ID del dispositivo GPS:', mascota.dispositivo?.id || '');
    if (nuevoDeviceId === null) return;
    
    const body = { deviceId: nuevoDeviceId };
    this.loading = true;
    
    this.mascotasService.updateDeviceId(mascota._id, body).subscribe({
      next: () => {
        if (!mascota.dispositivo) mascota.dispositivo = {};
        mascota.dispositivo.id = nuevoDeviceId;
        this.successMsg = 'Dispositivo GPS asociado correctamente.';
        this.loading = false;
        this.refreshData();
      },
      error: (err) => {
        this.errorMsg = err.error?.message || 'Error al asociar el dispositivo GPS.';
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
