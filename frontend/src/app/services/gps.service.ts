import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

export interface LocationData {
  id?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  method: 'GPS' | 'WiFi' | 'Cell';
  battery?: {
    level: number;
    charging: boolean;
  };
  timestamp: string;
  geofenceAlerts?: any[];
}

export interface Geofence {
  id?: string;
  name: string;
  description?: string;
  geometry: {
    type: 'Circle' | 'Polygon';
    center?: { latitude: number; longitude: number };
    radius?: number;
    coordinates?: number[][];
  };
  color: string;
  icon: string;
  alertSettings: {
    onEnter: boolean;
    onExit: boolean;
    onApproaching: boolean;
    approachingDistance: number;
    cooldownMinutes: number;
  };
  stats?: {
    totalEnters: number;
    totalExits: number;
    lastEntered?: string;
    lastExited?: string;
  };
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GpsService {
  private apiUrl = 'https://www.onichip.xyz/api';

  // Estado reactivo de ubicaciones
  private currentLocationsSubject = new BehaviorSubject<LocationData[]>([]);
  public currentLocations$ = this.currentLocationsSubject.asObservable();

  // Estado reactivo de geofences
  private geofencesSubject = new BehaviorSubject<Geofence[]>([]);
  public geofences$ = this.geofencesSubject.asObservable();

  constructor(private http: HttpClient) {}

  // 🗺️ OBTENER UBICACIONES DE UNA MASCOTA
  getMascotaLocations(mascotaId: string, options: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): Observable<any> {
    let params = new URLSearchParams();
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate) params.set('endDate', options.endDate);
    if (options.limit) params.set('limit', options.limit.toString());

    const url = `${this.apiUrl}/gps/mascota/${mascotaId}/locations?${params.toString()}`;
    return this.http.get<any>(url);
  }

  // 📍 OBTENER UBICACIÓN ACTUAL DE MASCOTA
  getCurrentLocation(mascotaId: string): Observable<LocationData | null> {
    return new Observable(observer => {
      this.getMascotaLocations(mascotaId, { limit: 1 }).subscribe({
        next: (response) => {
          if (response.success && response.locations.length > 0) {
            observer.next(response.locations[0]);
          } else {
            observer.next(null);
          }
          observer.complete();
        },
        error: (error) => {
          console.error('Error obteniendo ubicación actual:', error);
          observer.next(null);
          observer.complete();
        }
      });
    });
  }

  // 🗺️ GESTIÓN DE GEOFENCES

  // Crear geofence
  createGeofence(geofenceData: {
    mascotaId: string;
    name: string;
    description?: string;
    geometry: any;
    color?: string;
    icon?: string;
    alertSettings?: any;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/geofences`, geofenceData);
  }

  // Obtener geofences de una mascota
  getMascotaGeofences(mascotaId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/geofences/mascota/${mascotaId}`);
  }

  // Obtener geofences de un usuario
  getUserGeofences(usuarioId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/geofences/usuario/${usuarioId}`);
  }

  // Actualizar geofence
  updateGeofence(geofenceId: string, updates: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/geofences/${geofenceId}`, updates);
  }

  // Eliminar geofence
  deleteGeofence(geofenceId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/geofences/${geofenceId}`);
  }

  // Obtener estadísticas de geofence
  getGeofenceStats(geofenceId: string, days: number = 30): Observable<any> {
    return this.http.get(`${this.apiUrl}/geofences/${geofenceId}/stats?days=${days}`);
  }

  // 🔄 ACTUALIZAR ESTADO LOCAL
  updateCurrentLocations(locations: LocationData[]) {
    this.currentLocationsSubject.next(locations);
  }

  updateGeofences(geofences: Geofence[]) {
    this.geofencesSubject.next(geofences);
  }

  // 📊 CALCULAR DISTANCIA ENTRE DOS PUNTOS
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distancia en km
    return d;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // 🎨 UTILIDADES PARA MAPAS
  getRandomColor(): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF7675'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  getGeofenceIcons(): string[] {
    return ['🏠', '🏢', '🏫', '🏥', '🏪', '⛽', '🅿️', '🚩', '📍', '⭐'];
  }
}
