
import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, retry, timeout, map } from 'rxjs/operators';
import { Mascota } from '../../app/interfaces/mascota.interface';


@Injectable({ providedIn: 'root' })
export class MascotasService {
  private apiUrl = 'https://www.onichip.xyz/api/mascotas';
  private wsUrl = 'wss://www.onichip.xyz/api/mascotas'; // WebSocket a través de la ruta API
  private mascotasSubject = new BehaviorSubject<Mascota[]>([]);
  mascotas$ = this.mascotasSubject.asObservable();
  private ws: WebSocket | null = null;
  private pollingInterval: any = null;
  private currentOwnerId: string | null = null;

  constructor(private http: HttpClient, private ngZone: NgZone) {
    // Intentar WebSocket primero, pero no bloquear si falla
    this.tryConnectWebSocket();
  }

  private tryConnectWebSocket() {
    try {
      this.connectWebSocket();
    } catch (error) {
      console.warn('⚠️ WebSocket no disponible, usando modo polling:', error);
      // Fallback a polling si WebSocket falla
    }
  }

  private connectWebSocket() {
    console.log('🔌 Intentando conectar WebSocket a:', this.wsUrl);
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('🛰️ WebSocket mascotas conectado exitosamente');
    };

    this.ws.onmessage = (event) => {
      console.log('📩 Mensaje WebSocket recibido:', event.data);
      this.ngZone.run(() => {
        try {
          const msg = JSON.parse(event.data);
          console.log('📝 Mensaje parseado:', msg);
          if (msg.type === 'mascota_update') {
            console.log('🔄 Actualizando mascota via WebSocket:', msg.data);
            this.handleMascotaUpdate(msg.data);
          }
        } catch (e) {
          console.error('❌ Error parseando mensaje WS:', e, 'Data:', event.data);
        }
      });
    };

    this.ws.onerror = (error) => {
      console.error('❌ Error WebSocket:', error);
    };

    this.ws.onclose = (event) => {
      console.warn('❌ WebSocket desconectado. Code:', event.code, 'Reason:', event.reason);
      console.log('🔄 Reintentando conexión en 3 segundos...');
      setTimeout(() => this.connectWebSocket(), 3000);
    };
  }

  private handleMascotaUpdate(update: { action: string, mascota: Mascota }) {
    console.log('🔄 Procesando actualización:', update.action, 'para mascota:', update.mascota?.nombre);
    const mascotas = [...this.mascotasSubject.value];
    console.log('📊 Lista actual tiene', mascotas.length, 'mascotas');

    if (update.action === 'create') {
      mascotas.push(update.mascota);
      console.log('➕ Mascota agregada:', update.mascota.nombre);
    } else if (update.action === 'update') {
      const idx = mascotas.findIndex(m => m.deviceId === update.mascota.deviceId);
      if (idx !== -1) {
        mascotas[idx] = update.mascota;
        console.log('✏️ Mascota actualizada en índice', idx, ':', update.mascota.nombre);
      } else {
        console.warn('⚠️ No se encontró mascota con deviceId:', update.mascota.deviceId);
      }
    } else if (update.action === 'delete') {
      const idx = mascotas.findIndex(m => m.deviceId === update.mascota.deviceId);
      if (idx !== -1) {
        mascotas.splice(idx, 1);
        console.log('🗑️ Mascota eliminada del índice', idx);
      }
    }

    console.log('📊 Lista actualizada tiene', mascotas.length, 'mascotas');
    this.mascotasSubject.next(mascotas);
    console.log('✅ Observable actualizado');
  }
  /**
   * Inicializa la lista de mascotas para el usuario (solo una vez al entrar)
   */
  loadMascotasByOwner(ownerId: string) {
    this.getMascotasByOwner(ownerId).subscribe((mascotas: Mascota[]) => {
      this.mascotasSubject.next(mascotas);
    });
  }

  getMascotasByOwner(ownerId: string): Observable<Mascota[]> {
    return this.http.get<Mascota[]>(`${this.apiUrl}/owner/${ownerId}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
      }
    }).pipe(
      timeout(8000),
      retry(1),
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene una mascota por deviceId usando el endpoint GET correcto
   */
  getMascotaByDeviceId(deviceId: string): Observable<Mascota | null> {
    return this.http.get<Mascota | null>(`${this.apiUrl}/dev/${deviceId}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
      }
    }).pipe(
      timeout(5000),
      retry(1),
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene varias mascotas por un array de deviceIds (paralelamente)
   */
  getMascotasByDeviceIds(deviceIds: string[]): Observable<Mascota[]> {
    // Realiza varias peticiones en paralelo y combina los resultados
    return new Observable<Mascota[]>(subscriber => {
      Promise.all(deviceIds.map(id => this.getMascotaByDeviceId(id).toPromise()))
        .then(results => {
          subscriber.next(results.filter(Boolean) as Mascota[]);
          subscriber.complete();
        })
        .catch(err => subscriber.error(err));
    });
  }

  updateDeviceId(currentDeviceId: string, body: { deviceId: string }): Observable<any> {
    console.log('🔄 Actualizando dispositivo - currentDeviceId:', currentDeviceId, 'newDeviceId:', body.deviceId);
    return this.http.put(`${this.apiUrl}/dev/${currentDeviceId}`, body, {
      headers: {
        'Content-Type': 'application/json'
      }
    }).pipe(
      timeout(8000),
      // NO hacer retry en caso de errores 400 (como deviceId duplicado)
      catchError((error) => {
        if (error.status === 400) {
          // Para errores 400, no reintentar - devolver el error directamente
          return throwError(() => error);
        }
        // Para otros errores, usar el handleError estándar
        return this.handleError(error);
      })
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Error desconocido';

    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Error de conexión: ${error.error.message}`;
    } else {
      // Error del servidor
      if (error.status === 400 && error.error?.error === 'DUPLICATE_DEVICE_ID') {
        // Error específico de deviceId duplicado
        return throwError(() => error);
      }
      errorMessage = `Error del servidor: ${error.status} - ${error.message}`;
    }

    console.error('Error en servicio de mascotas:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
