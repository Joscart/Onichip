import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class MascotasService {
  private apiUrl = 'http://18.223.160.105:3000/api/device';

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

  updateDeviceId(mascotaId: string, body: { deviceId: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/dev/${mascotaId}`, body, {
      headers: {
        'Content-Type': 'application/json'
      }
    }).pipe(
      timeout(8000),
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Error desconocido';

    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Error de conexión: ${error.error.message}`;
    } else {
      // Error del servidor
      errorMessage = `Error del servidor: ${error.status} - ${error.message}`;
    }

    console.error('Error en servicio de mascotas:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
