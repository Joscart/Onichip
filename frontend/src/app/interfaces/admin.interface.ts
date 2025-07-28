/**
 * ================================================
 * 📊 INTERFACES PARA ADMIN - REPORTES Y EXCEL
 * ================================================
 *
 * Interfaces TypeScript para el sistema de reportes y exportación Excel
 *
 * @author Onichip Team
 * @version 2.0
 */

// Interfaz principal para la función generateExcelReport
export interface ExcelExportRequest {
  data: Array<any>;          // Array de registros con claves dinámicas
  tipo: string;              // Tipo de reporte (dispositivos, ubicaciones, etc.)
  fechaInicio?: string;      // Filtro fecha inicio (opcional)
  fechaFin?: string;         // Filtro fecha fin (opcional)
  mascota?: string;          // Filtro por mascota (opcional)
}

// Respuesta del backend para reportes
export interface ReportResponse {
  tipo: string;
  total: number;
  data?: Array<any>;
  mascotas?: Array<any>;
  dispositivos?: Array<any>;
  ubicaciones?: Array<any>;
  actividad?: Array<any>;
  estadisticas?: Array<any>;
  auditoria?: Array<any>;
  metadata?: {
    generado: string;
    processingTime: number;
    fuente: string;
  };
}

// Filtros para generar reportes
export interface ReportFilters {
  tipoReporte: string;
  fechaInicio?: string | Date;
  fechaFin?: string | Date;
  mascotaId?: string;
}

// Métricas del dashboard (actualizada según backend real)
export interface DashboardMetrics {
  resumen: {
    operaciones_24h: number;
    usuarios_activos_24h: number;
    tasa_exito: string;
    ubicaciones_gps_24h: number;
    // Propiedades adicionales para compatibilidad
    total_usuarios?: number;
    usuarios_nuevos_30d?: number;
    total_mascotas?: number;
    mascotas_nuevas_30d?: number;
    dispositivos_conectados?: number;
    alertas_24h?: number;
    usuarios_activos?: number;
  };
  graficos: {
    actividad_por_hora: Array<any>;
    top_entidades: Array<any>;
    estados_sistema: Array<any>;
    // Propiedades adicionales para compatibilidad
    mascotas_por_especie?: Array<any>;
    actividad_por_periodo?: {
      matutino: number;
      vespertino: number;
      nocturno: number;
    };
    dispositivos_por_hora?: number[];
  };
  timestamp: string;
  processingTime: number;
}

// Datos de autenticación del admin
export interface AdminData {
  id: string;
  nombre: string;
  email: string;
  token: string;
  isAuthenticated: boolean;
}

// Tipos de reportes disponibles
export interface TipoReporte {
  value: string;
  label: string;
  description: string;
}

// Datos para gráficos (actualizado para los 3 gráficos específicos)
export interface ChartData {
  mascotas?: {
    perros: number;
    gatos: number;
    otros: number;
  };
  actividadDispositivos?: number[]; // Array de 24 elementos (por hora)
  dispositivosHora?: number[]; // Array de 24 elementos (por hora)
  usuariosActivos?: {
    matutino: number;   // 6-12h
    vespertino: number; // 12-20h
    nocturno: number;   // 20-6h
  };
  // Propiedades legacy para compatibilidad
  perros?: number;
  gatos?: number;
  otros?: number;
  actividadMensual?: number[];
  dispositivosActivos?: number[];
}

// Estructura de datos del reporte final en el frontend
export interface ReporteData {
  total: number;
  data: Array<any>;
  ubicaciones?: Array<any>;
  alertas?: Array<any>;
}
