
import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, retry, timeout, map } from 'rxjs/operators';
import { Mascota } from '../../app/interfaces/mascota.interface';


@Injectable({ providedIn: 'root' })
export class MascotasService {
  private apiUrl = 'http://localhost:3000/api/mascotas';
  private wsUrl = 'ws://localhost:3000'; // Cambia a ws://localhost:3000 si es local
  private mascotasSubject = new BehaviorSubject<Mascota[]>([]);
  mascotas$ = this.mascotasSubject.asObservable();
  private ws: WebSocket | null = null;

  constructor(private http: HttpClient, private ngZone: NgZone) {
    this.connectWebSocket();
  }

  private connectWebSocket() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onopen = () => {
      console.log('🛰️ WebSocket mascotas conectado');
    };
    this.ws.onmessage = (event) => {
      this.ngZone.run(() => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'mascota_update') {
            this.handleMascotaUpdate(msg.data);
          }
        } catch (e) {
          console.error('Error parseando mensaje WS:', e);
        }
      });
    };
    this.ws.onclose = () => {
      console.warn('WebSocket mascotas desconectado, reintentando en 3s...');
      setTimeout(() => this.connectWebSocket(), 3000);
    };
  }

  private handleMascotaUpdate(update: { action: string, mascota: Mascota }) {
    const mascotas = [...this.mascotasSubject.value];
    if (update.action === 'create') {
      mascotas.push(update.mascota);
    } else if (update.action === 'update') {
      const idx = mascotas.findIndex(m => m.deviceId === update.mascota.deviceId);
      if (idx !== -1) mascotas[idx] = update.mascota;
    } else if (update.action === 'delete') {
      const idx = mascotas.findIndex(m => m.deviceId === update.mascota.deviceId);
      if (idx !== -1) mascotas.splice(idx, 1);
    }
    this.mascotasSubject.next(mascotas);
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
