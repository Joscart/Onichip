
import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { MascotasService } from './mascotas.service';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { Subject, takeUntil, timeout, catchError, of } from 'rxjs';
import * as L from 'leaflet';
import { NavbarComponent } from '../navbar/navbar';

@Component({
  selector: 'app-homeusuario',
  templateUrl: './homeusuario.html',
  styleUrl: './homeusuario.css',
  standalone: true,
  imports: [CommonModule, DatePipe, NavbarComponent]
})
export class Homeusuario implements OnInit, OnDestroy, AfterViewInit {
  mascotas: any[] = [];
  loading = true;
  user: any = null;
  successMsg = '';
  errorMsg = '';
  
  // Estados del mapa
  showMapModal = false;
  selectedMascota: any = null;
  mapLoading = false;
  mapError = false;
  mapUpdateInterval: any = null; // Cambiado a público
  
  // Referencias del mapa
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  private map: L.Map | null = null;
  private petMarker: L.Marker | null = null;
  private accuracyCircle: L.Circle | null = null;
  
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

  ngAfterViewInit() {
    // Se ejecutará después de que la vista esté completamente inicializada
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Limpiar intervals
    if (this.mapUpdateInterval) {
      clearInterval(this.mapUpdateInterval);
    }
    
    // Limpiar el mapa si existe
    if (this.map) {
      this.map.remove();
    }
  }

  // 🔄 CONFIGURAR ACTUALIZACIÓN AUTOMÁTICA
  setupAutoRefresh() {
    setInterval(() => {
      this.refreshLocationData();
      
      // Si el modal del mapa está abierto, actualizar el mapa también
      if (this.showMapModal && this.selectedMascota) {
        this.updateMapLocation();
      }
    }, 30000); // 30 segundos
  }

  // 🔄 ACTUALIZAR DATOS DE UBICACIÓN (simulado por ahora)
  refreshLocationData() {
    // Por ahora simular datos GPS hasta que el servicio esté funcionando
    this.mascotas.forEach(mascota => {
      if (mascota._id) {
        // Guardar ubicación anterior para detectar cambios
        const oldLocation = mascota.ubicacionActual ? { ...mascota.ubicacionActual } : null;
        
        // Simular datos GPS aleatorios para demo
        mascota.ubicacionActual = {
          latitude: 19.4326 + (Math.random() - 0.5) * 0.01,
          longitude: -99.1332 + (Math.random() - 0.5) * 0.01,
          accuracy: Math.floor(Math.random() * 10) + 5,
          speed: Math.floor(Math.random() * 20),
          method: Math.random() > 0.7 ? 'WiFi' : 'GPS',
          timestamp: new Date().toISOString()
        };
        
        // Si el mapa está abierto y es la mascota seleccionada, actualizar el mapa
        if (this.showMapModal && this.selectedMascota && 
            this.selectedMascota._id === mascota._id) {
          
          // Verificar si la ubicación cambió significativamente
          if (oldLocation) {
            const latDiff = Math.abs(mascota.ubicacionActual.latitude - oldLocation.latitude);
            const lngDiff = Math.abs(mascota.ubicacionActual.longitude - oldLocation.longitude);
            
            if (latDiff > 0.000001 || lngDiff > 0.000001) { // Cambio mínimo detectable
              console.log('📍 Nueva ubicación detectada, actualizando mapa...');
              this.selectedMascota.ubicacionActual = mascota.ubicacionActual;
              setTimeout(() => this.updateMapLocation(), 100);
            }
          } else {
            // Primera vez que se obtiene ubicación
            this.selectedMascota.ubicacionActual = mascota.ubicacionActual;
            setTimeout(() => this.updateMapLocation(), 100);
          }
        }
        
        if (!mascota.dispositivo) {
          mascota.dispositivo = {};
        }
        mascota.dispositivo.bateria = {
          nivel: Math.floor(Math.random() * 100) + 1,
          cargando: Math.random() > 0.8
        };
      }
    });
    
    // Forzar detección de cambios después de actualizar todas las mascotas
    this.cdr.detectChanges();
    console.log('🔄 Datos de ubicación actualizados para', this.mascotas.length, 'mascotas');
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
    this.mapError = false;
    
    // Configurar actualización más frecuente para el mapa (cada 10 segundos)
    this.setupMapAutoUpdate();
    
    // Inicializar el mapa después de que el modal se abra
    setTimeout(() => {
      this.initializeMap();
    }, 100);
  }

  closeMapModal() {
    this.showMapModal = false;
    this.selectedMascota = null;
    
    // Limpiar actualización frecuente del mapa
    if (this.mapUpdateInterval) {
      clearInterval(this.mapUpdateInterval);
      this.mapUpdateInterval = null;
    }
    
    // Limpiar el mapa
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.petMarker = null;
      this.accuracyCircle = null;
    }
  }

  // 🔄 ALTERNAR AUTO-ACTUALIZACIÓN DEL MAPA
  toggleAutoUpdate() {
    if (this.mapUpdateInterval) {
      // Pausar auto-actualización
      clearInterval(this.mapUpdateInterval);
      this.mapUpdateInterval = null;
      console.log('⏸️ Auto-actualización pausada');
    } else {
      // Activar auto-actualización
      this.setupMapAutoUpdate();
      console.log('▶️ Auto-actualización activada (cada 10s)');
    }
  }

  // 🔄 CONFIGURAR ACTUALIZACIÓN AUTOMÁTICA DEL MAPA
  setupMapAutoUpdate() {
    // Limpiar interval anterior si existe
    if (this.mapUpdateInterval) {
      clearInterval(this.mapUpdateInterval);
    }
    
    // Actualizar cada 10 segundos cuando el mapa esté abierto
    this.mapUpdateInterval = setInterval(() => {
      if (this.showMapModal && this.selectedMascota) {
        console.log('🔄 Actualizando ubicación del mapa automáticamente...');
        this.refreshSingleMascotaLocation(this.selectedMascota);
      }
    }, 10000); // 10 segundos
  }

  // 🔄 ACTUALIZAR UBICACIÓN DE UNA MASCOTA ESPECÍFICA
  refreshSingleMascotaLocation(mascota: any) {
    if (!mascota) return;
    
    // Guardar ubicación anterior
    const oldLocation = mascota.ubicacionActual ? { ...mascota.ubicacionActual } : null;
    
    // Simular nueva ubicación GPS (reemplazar con llamada real al API)
    const newLocation = {
      latitude: 19.4326 + (Math.random() - 0.5) * 0.01,
      longitude: -99.1332 + (Math.random() - 0.5) * 0.01,
      accuracy: Math.floor(Math.random() * 10) + 5,
      speed: Math.floor(Math.random() * 20),
      method: Math.random() > 0.7 ? 'WiFi' : 'GPS',
      timestamp: new Date().toISOString()
    };
    
    // Actualizar la ubicación
    mascota.ubicacionActual = newLocation;
    
    // Si hay cambio significativo, actualizar el mapa
    if (oldLocation) {
      const latDiff = Math.abs(newLocation.latitude - oldLocation.latitude);
      const lngDiff = Math.abs(newLocation.longitude - oldLocation.longitude);
      
      if (latDiff > 0.000001 || lngDiff > 0.000001) {
        console.log('📍 Ubicación actualizada:', newLocation);
        this.updateMapLocation();
      }
    } else {
      // Primera ubicación
      console.log('📍 Primera ubicación obtenida:', newLocation);
      this.updateMapLocation();
    }
    
    this.cdr.detectChanges();
  }

  // 🗺️ INICIALIZAR MAPA CON LEAFLET
  initializeMap() {
    if (!this.selectedMascota?.ubicacionActual) {
      console.warn('No hay datos de ubicación para mostrar en el mapa');
      return;
    }

    this.mapLoading = true;
    this.mapError = false;

    try {
      // Limpiar mapa existente
      if (this.map) {
        this.map.remove();
      }

      const location = this.selectedMascota.ubicacionActual;
      const lat = location.latitude;
      const lng = location.longitude;
      const accuracy = location.accuracy || 10;

      // Crear el mapa centrado en la ubicación de la mascota
      this.map = L.map('pet-map', {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
        attributionControl: true
      });

      // Añadir capa base del mapa (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.map);

      // Crear icono personalizado para la mascota
      const petIcon = L.divIcon({
        html: this.getPetMapIcon(this.selectedMascota),
        className: 'pet-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
      });

      // Añadir marcador de la mascota
      this.petMarker = L.marker([lat, lng], { icon: petIcon })
        .addTo(this.map)
        .bindPopup(this.createPetPopupContent(this.selectedMascota))
        .openPopup();

      // Añadir círculo de precisión
      this.accuracyCircle = L.circle([lat, lng], {
        radius: accuracy,
        color: '#007bff',
        fillColor: '#007bff',
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '5, 5'
      }).addTo(this.map);

      // Ajustar vista para incluir el círculo de precisión
      const group = new L.FeatureGroup([this.petMarker, this.accuracyCircle]);
      this.map.fitBounds(group.getBounds(), { padding: [20, 20] });

      this.mapLoading = false;
      console.log('🗺️ Mapa inicializado correctamente');

    } catch (error) {
      console.error('❌ Error al inicializar el mapa:', error);
      this.mapError = true;
      this.mapLoading = false;
    }
  }

  // 🎯 CENTRAR MAPA EN LA MASCOTA
  centerMap() {
    if (!this.map || !this.selectedMascota?.ubicacionActual) return;

    const location = this.selectedMascota.ubicacionActual;
    this.map.setView([location.latitude, location.longitude], 16);
  }

  // 🔄 ACTUALIZAR UBICACIÓN EN EL MAPA
  refreshLocation() {
    if (!this.selectedMascota) return;

    // Simular actualización de ubicación (reemplazar con llamada real al API)
    this.simulateLocationUpdate();
    
    // Actualizar el mapa con los nuevos datos
    this.updateMapLocation();
  }

  // 🗺️ ACTUALIZAR MAPA CON NUEVA UBICACIÓN (sin reinicializar)
  updateMapLocation() {
    if (!this.map || !this.selectedMascota?.ubicacionActual) return;

    const location = this.selectedMascota.ubicacionActual;
    const lat = location.latitude;
    const lng = location.longitude;
    const accuracy = location.accuracy || 10;

    try {
      // Actualizar posición del marcador con animación suave
      if (this.petMarker) {
        // Animar el movimiento del marcador
        const currentLatLng = this.petMarker.getLatLng();
        const newLatLng = L.latLng(lat, lng);
        
        // Solo animar si la distancia es significativa pero no muy grande
        const distance = currentLatLng.distanceTo(newLatLng);
        if (distance > 1 && distance < 1000) { // Entre 1m y 1km
          this.animateMarkerToPosition(currentLatLng, newLatLng);
        } else {
          this.petMarker.setLatLng([lat, lng]);
        }
        
        // Actualizar el contenido del popup
        this.petMarker.setPopupContent(this.createPetPopupContent(this.selectedMascota));
        
        // Actualizar el icono si el estado cambió
        const newIcon = L.divIcon({
          html: this.getPetMapIcon(this.selectedMascota),
          className: 'pet-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -20]
        });
        this.petMarker.setIcon(newIcon);
      }

      // Actualizar círculo de precisión con animación
      if (this.accuracyCircle) {
        this.accuracyCircle.setLatLng([lat, lng]);
        this.accuracyCircle.setRadius(accuracy);
        
        // Cambiar color del círculo basado en la precisión
        const color = accuracy < 10 ? '#28a745' : accuracy < 20 ? '#ffc107' : '#dc3545';
        this.accuracyCircle.setStyle({ color: color, fillColor: color });
      }

      // Centrar suavemente el mapa en la nueva posición solo si está lejos del centro
      const mapCenter = this.map.getCenter();
      const newCenter = L.latLng(lat, lng);
      if (mapCenter.distanceTo(newCenter) > 100) { // Solo si está más de 100m del centro
        this.map.panTo([lat, lng], { animate: true, duration: 1 });
      }

      console.log('🗺️ Mapa actualizado con nueva ubicación:', { lat, lng, accuracy });

    } catch (error) {
      console.error('❌ Error al actualizar el mapa:', error);
      // Si hay error, reinicializar el mapa completo
      this.initializeMap();
    }
  }

  // 🎬 ANIMAR MARCADOR A NUEVA POSICIÓN
  animateMarkerToPosition(fromLatLng: L.LatLng, toLatLng: L.LatLng) {
    if (!this.petMarker) return;

    const steps = 20; // Número de pasos en la animación
    const stepLat = (toLatLng.lat - fromLatLng.lat) / steps;
    const stepLng = (toLatLng.lng - fromLatLng.lng) / steps;
    let currentStep = 0;

    const animateStep = () => {
      if (currentStep < steps && this.petMarker) {
        currentStep++;
        const newLat = fromLatLng.lat + (stepLat * currentStep);
        const newLng = fromLatLng.lng + (stepLng * currentStep);
        
        this.petMarker.setLatLng([newLat, newLng]);
        
        setTimeout(animateStep, 50); // 50ms entre pasos = 1s total
      }
    };

    animateStep();
  }

  // 🏷️ CREAR ICONO DEL MAPA PARA LA MASCOTA
  getPetMapIcon(mascota: any): string {
    const petEmoji = mascota.tipo === 'Perro' ? '🐕' : '🐱';
    const statusColor = this.getLocationStatusColor(mascota);
    
    return `
      <div class="pet-map-icon" style="background-color: ${statusColor}">
        <span class="pet-emoji">${petEmoji}</span>
      </div>
    `;
  }

  // 🎨 OBTENER COLOR DEL ESTADO DE UBICACIÓN
  getLocationStatusColor(mascota: any): string {
    const status = this.getLocationStatus(mascota);
    switch (status) {
      case 'online': return '#28a745';
      case 'warning': return '#ffc107';
      case 'offline': return '#dc3545';
      default: return '#6c757d';
    }
  }

  // 📋 CREAR CONTENIDO DEL POPUP
  createPetPopupContent(mascota: any): string {
    const location = mascota.ubicacionActual;
    const lastUpdate = this.getLastLocationUpdate(mascota);
    
    return `
      <div class="pet-popup">
        <h4>${mascota.nombre}</h4>
        <div class="popup-info">
          <p><strong>📍 Coordenadas:</strong><br>
             ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</p>
          <p><strong>🎯 Precisión:</strong> ${location.accuracy}m</p>
          <p><strong>🏃 Velocidad:</strong> ${location.speed || 0} km/h</p>
          <p><strong>📶 Método:</strong> ${location.method || 'GPS'}</p>
          <p><strong>⏰ Actualizado:</strong> ${lastUpdate}</p>
        </div>
      </div>
    `;
  }

  // 🎲 SIMULAR ACTUALIZACIÓN DE UBICACIÓN (temporal)
  simulateLocationUpdate() {
    if (!this.selectedMascota?.ubicacionActual) return;

    const location = this.selectedMascota.ubicacionActual;
    
    // Pequeña variación en la ubicación para simular movimiento
    location.latitude += (Math.random() - 0.5) * 0.0001;
    location.longitude += (Math.random() - 0.5) * 0.0001;
    location.accuracy = Math.floor(Math.random() * 15) + 5;
    location.speed = Math.floor(Math.random() * 10);
    location.timestamp = new Date().toISOString();
    
    console.log('🔄 Ubicación actualizada:', location);
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

  // Asociar o editar el deviceId de una mascota
  asociarDispositivo(mascota: any) {
    const nuevoDeviceId = prompt('Ingrese el nuevo ID del dispositivo GPS:', mascota.dispositivo?.id || '');
    if (nuevoDeviceId === null) return;
    
    // Validar que no esté vacío
    if (!nuevoDeviceId || nuevoDeviceId.trim() === '') {
      this.errorMsg = 'El ID del dispositivo no puede estar vacío.';
      setTimeout(() => this.errorMsg = '', 3000);
      return;
    }
    
    // Usar el deviceId actual de la mascota para buscarla en el backend
    const currentDeviceId = mascota.deviceId || mascota.dispositivo?.id;
    
    if (!currentDeviceId) {
      this.errorMsg = 'Error: No se encontró el ID actual del dispositivo.';
      setTimeout(() => this.errorMsg = '', 3000);
      return;
    }
    
    // Validar que el nuevo ID sea diferente al actual
    if (nuevoDeviceId.trim() === currentDeviceId) {
      this.errorMsg = 'El nuevo ID debe ser diferente al actual.';
      setTimeout(() => this.errorMsg = '', 3000);
      return;
    }
    
    const body = { 
      deviceId: nuevoDeviceId.trim(),
      'dispositivo.id': nuevoDeviceId.trim() 
    };
    this.loading = true;
    this.errorMsg = ''; // Limpiar errores previos
    
    console.log('🔄 Actualizando dispositivo:', currentDeviceId, '->', nuevoDeviceId);
    console.log('📝 Datos a enviar:', body);
    
    this.mascotasService.updateDeviceId(currentDeviceId, body).subscribe({
      next: () => {
        if (!mascota.dispositivo) mascota.dispositivo = {};
        mascota.dispositivo.id = nuevoDeviceId;
        mascota.deviceId = nuevoDeviceId; // Actualizar también el deviceId principal
        this.successMsg = 'Dispositivo GPS asociado correctamente.';
        this.loading = false;
        this.refreshData();
      },
      error: (err) => {
        console.error('❌ Error al actualizar dispositivo:', err);
        this.loading = false;
        
        // Manejo específico para deviceId duplicado
        if (err.error?.error === 'DUPLICATE_DEVICE_ID') {
          this.errorMsg = `El ID "${nuevoDeviceId}" ya está en uso. Por favor, elija un ID diferente.`;
        } else {
          this.errorMsg = err.error?.message || 'Error al asociar el dispositivo GPS.';
        }
        
        // Limpiar el mensaje de error después de 5 segundos
        setTimeout(() => {
          this.errorMsg = '';
        }, 5000);
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

  // ===== MÉTODOS PARA NAVBAR =====
  
  // Manejar logout desde navbar
  onLogout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    this.router.navigate(['/acceso']);
  }

  // Navegar a registro de mascota
  onNavigateToRegister() {
    this.router.navigate(['/registromascota']);
  }
}
