export interface Mascota {
  _id?: string;
  deviceId: string;
  nombre: string;
  propietario: any;
  ubicacionActual?: {
    latitud: number;      // Mantener latitud (como envía el backend)
    longitud: number;     // Mantener longitud (como envía el backend)
    precision?: number;   // Mantener precision (como envía el backend)
    timestamp?: string;
    metodo?: string;      // Mantener metodo (como envía el backend)
    speed?: number;
  };
  dispositivo?: {
    id: string;
    tipo?: string;
    version?: string;
    ultimaConexion?: string;
    estadoBateria?: {     // Mantener estadoBateria (como envía el backend)
      nivel?: number;
      cargando?: boolean;
      ultimaActualizacion?: string;
    };
  };
  especie: string;        // Mantener especie (como envía el backend)
  raza?: string;
  edad?: number;
  peso?: number;
  color?: string;
  veterinario?: {
    nombre?: string;
    telefono?: string;
    direccion?: string;
  };
  configuracion?: {
    frecuenciaReporte?: number;
    alertasActivas?: boolean;
    compartirUbicacion?: boolean;
  };
  estadisticas?: {
    totalDistancia?: number;    // Mantener como envía el backend
    tiempoActividad?: number;   // Mantener como envía el backend
    zonasVisitadas?: number;
    ultimaActividad?: string;
  };
  activo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
