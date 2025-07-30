export interface Mascota {
  _id?: string;
  deviceId: string;
  nombre: string;
  propietario: any;
  ubicacionActual?: {
    latitud: number;
    longitud: number;
    precision?: number;
    timestamp?: string;
    metodo?: string;
  };
  dispositivo?: {
    id: string;
    tipo?: string;
    version?: string;
    ultimaConexion?: string;
    estadoBateria?: {
      nivel?: number;
      cargando?: boolean;
      ultimaActualizacion?: string;
    };
  };
  especie: string;
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
    totalDistancia?: number;
    tiempoActividad?: number;
    zonasVisitadas?: number;
    ultimaActividad?: string;
  };
  activo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
