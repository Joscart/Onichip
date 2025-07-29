import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';

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
