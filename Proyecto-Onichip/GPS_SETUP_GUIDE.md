# 🛰️ GUÍA DE CONFIGURACIÓN GPS NEO-6M

## 📋 Verificación de Hardware

### 1. Conexiones del Módulo GPS
```
GPS NEO-6M  →  LILYGO T-Call v1.4
VCC         →  3.3V (NO usar 5V)
GND         →  GND
TX          →  Pin 33 (GPS_TX_PIN)
RX          →  Pin 32 (GPS_RX_PIN)
```

**IMPORTANTE**: Los pines 33 y 32 están disponibles en el T-Call v1.4 y son seguros para SoftwareSerial.

### 2. Antena GPS
- ✅ **CRÍTICO**: Conectar antena activa o pasiva
- ✅ Ubicar antena lejos de componentes RF (SIM800)
- ✅ Antena con vista despejada al cielo
- ❌ NO funciona en interiores sin antena externa

### 3. Alimentación
- ✅ GPS requiere alimentación estable 3.3V
- ✅ Corriente: ~50mA en búsqueda, ~25mA en tracking
- ⚠️ Verificar que el ESP32 suministre suficiente corriente

## 🔧 Diagnóstico de Problemas

### Problema: "GPS no responde"
**Causa**: No hay comunicación serie
**Solución**:
1. Verificar conexiones TX/RX cruzadas
2. Comprobar alimentación 3.3V
3. Medir voltaje en VCC del GPS (debe ser 3.2-3.4V)

### Problema: "Satélites: 0"
**Causa**: No hay señal GPS
**Solución**:
1. Conectar antena GPS
2. Mover a área abierta (sin techo)
3. Esperar 2-5 minutos para cold start
4. Alejar de fuentes de interferencia

### Problema: "Sats: X pero sin fix"
**Causa**: Satélites insuficientes o HDOP alto
**Solución**:
1. Necesita mínimo 4 satélites para fix 3D
2. HDOP < 2.5 para buena precisión
3. Mejorar posición de antena
4. Esperar más tiempo (hasta 30s cold start)

## 📍 Optimización para Ecuador

### Configuración Actual
- **Región**: Ecuador (optimizada)
- **Constelaciones**: GPS + GLONASS + BeiDou
- **Tasa**: 5Hz (actualización cada 200ms)
- **SBAS**: Habilitado (mejora precisión)
- **Modo**: Tracking dinámico

### Satélites Visibles en Ecuador
- **GPS**: ~8-12 satélites
- **GLONASS**: ~6-10 satélites  
- **BeiDou**: ~6-8 satélites
- **Total esperado**: 20-30 satélites

## ⏱️ Tiempos de Fix Esperados

### Cold Start (primera vez)
- **Sin asistencia**: 30-120 segundos
- **Con SBAS**: 15-60 segundos
- **Ubicación óptima**: 15-30 segundos

### Warm Start (reinicio)
- **Con datos válidos**: 5-15 segundos
- **Pérdida temporal**: 10-30 segundos

### Hot Start (reactivación)
- **Datos recientes**: 1-5 segundos

## 🔍 Comandos de Diagnóstico

### Monitor Serie (115200 baud)
```
🔧 === DIAGNÓSTICO GPS NEO-6M ===
📡 Test 1: Comunicación serie GPS...
✅ GPS respondiendo - 1247 caracteres recibidos

📡 Test 2: Estado satelital...
🛰️ Satélites visibles: 8
📊 HDOP (precisión): 1.2
📍 Ubicación: -2.123456, -79.123456
✅ GPS con FIX!
```

### Interpretación de Resultados
- **Caracteres < 100**: Problema de comunicación
- **Satélites < 4**: Posición inadecuada  
- **HDOP > 2.5**: Precisión insuficiente
- **Sin ubicación**: Esperar más tiempo

## 📱 Solución de Problemas Comunes

### 1. GPS funciona pero pierde fix
**Causa**: Interferencia o movimiento rápido
**Solución**:
- Verificar que la antena esté fija
- Reducir velocidad de movimiento durante pruebas
- Alejar de SIM800 y WiFi activo

### 2. Fix lento o intermitente  
**Causa**: Señal débil o configuración subóptima
**Solución**:
- Usar antena externa con cable
- Ubicar antena en punto más alto
- Verificar que no hay obstáculos metálicos

### 3. Coordenadas incorrectas
**Causa**: Fix de baja calidad o interferencia
**Solución**:
- Verificar HDOP < 2.5
- Confirmar ≥4 satélites
- Probar en diferentes ubicaciones

## 🌍 Configuración por Regiones

### Para cambiar región, editar `gps_config.h`:
```cpp
// ECUADOR (actual)
#define GPS_REGION_ECUADOR

// USA  
#define GPS_REGION_USA

// EUROPA
#define GPS_REGION_EUROPE
```

## 📞 Soporte Técnico

### Logs Útiles para Diagnóstico
1. Monitor serie completo durante 2-3 minutos
2. Resultado de `diagnosticoGPS()`
3. Foto de conexiones del módulo
4. Ubicación de prueba (interior/exterior)

### Información del Sistema
- **Módulo**: GPS NEO-6M (GY-GPS6MV2)
- **Protocolo**: NMEA 0183
- **Baudios**: 9600
- **Voltaje**: 3.3V DC
- **Corriente**: 25-50mA
