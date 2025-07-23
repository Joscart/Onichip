// ====================== gps_config.h ======================
// Configuración simplificada para GPS NEO-6M en Ecuador
#ifndef GPS_CONFIG_H
#define GPS_CONFIG_H

// ————— CONFIGURACIÓN PARA ECUADOR —————
#define GPS_SBAS_ENABLED                1       // WAAS/EGNOS/MSAS mejorado
#define GPS_UPDATE_RATE_MS              200     // 5Hz (óptimo para tracking)
#define GPS_MIN_SATELLITES              4       // Mínimo para fix 3D
#define GPS_MIN_HDOP                    2.5     // HDOP máximo aceptable

// ————— COMANDOS NMEA PRECONFIGURADOS —————
// Configurar tasa de actualización a 5Hz (200ms)
#define CMD_UPDATE_RATE     "$PMTK220,200*2C"

// Configurar solo sentencias NMEA esenciales (GGA, RMC)
#define CMD_NMEA_OUTPUT     "$PMTK314,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0*28"

// Activar SBAS para mejor precisión
#define CMD_SBAS_ON         "$PMTK313,1*2E"

// Modo dinámico para tracking
#define CMD_DYNAMIC_MODEL   "$PMTK886,3*29"

// Datum WGS84 (estándar mundial)
#define CMD_DATUM_WGS84     "$PMTK330,0*2E"

// Antena activa
#define CMD_ANTENNA_ON      "$PMTK285,0,100*3F"

// ————— TIMEOUTS PARA DIFERENTES TIPOS DE START —————
#define GPS_COLD_START_TIMEOUT_MS       30000   // 30s para primer fix
#define GPS_WARM_START_TIMEOUT_MS       10000   // 10s para fix subsecuente
#define GPS_HOT_START_TIMEOUT_MS        5000    // 5s para fix rápido

// ————— CONFIGURACIÓN DE DEBUG —————
#define GPS_DEBUG_ENABLED               1       // Mostrar info debug
#define GPS_RAW_NMEA_ENABLED            0       // Mostrar NMEA raw (solo para debug avanzado)

#endif // GPS_CONFIG_H
