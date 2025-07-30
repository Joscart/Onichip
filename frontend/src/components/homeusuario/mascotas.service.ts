import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry, timeout, map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class MascotasService {
  private apiUrl = 'https://www.onichip.xyz/api/device';

  constructor(private http: HttpClient) {}

  getMascotasByOwner(ownerId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/owner/${ownerId}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
      }
    }).pipe(
      timeout(8000), // Timeout de 8 segundos
      retry(1), // Reintentar 1 vez automáticamente
      catchError(this.handleError)
    );
  }

  getMascotaRealtime(deviceId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/realtime/${deviceId}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
      }
    }).pipe(
      timeout(5000),
      retry(1),
      map((response: any) => {
        if (response && response.ubicacionActual) {
          // Asegurarnos que los valores de latitud y longitud son números
          response.ubicacionActual.latitude = Number(response.ubicacionActual.latitude);
          response.ubicacionActual.longitude = Number(response.ubicacionActual.longitude);
        }
        return response;
      }),
      catchError(this.handleError)
    );
  }

  getMascotasRealtimeBatch(deviceIds: string[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/realtime/batch`, { deviceIds }, {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
      }
    }).pipe(
      timeout(8000),
      retry(1),
      map((response: any) => {
        if (Array.isArray(response)) {
          // Procesar cada dispositivo en el batch
          return response.map(device => {
            if (device && device.ubicacionActual) {
              // Asegurarnos que los valores de latitud y longitud son números
              device.ubicacionActual.latitude = Number(device.ubicacionActual.latitude);
              device.ubicacionActual.longitude = Number(device.ubicacionActual.longitude);
            }
            return device;
          });
        }
        return response;
      }),
      catchError(this.handleError)
    );
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
