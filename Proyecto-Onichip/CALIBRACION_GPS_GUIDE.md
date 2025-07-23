# 🎯 Guía de Verificación de Calibración GPS NEO-6M

## 📋 Cómo Saber si el GPS se Está Calibrando Correctamente

### 🚀 Métodos de Verificación

#### 1. **Monitor Serie Arduino IDE**
```cpp
// Descomenta esta línea en setup() para verificación completa:
verificarCalibracionGPS();
```

#### 2. **Indicadores en Tiempo Real**

**✅ CALIBRACIÓN CORRECTA:**
```
🛰️ Satélites: 6 ✅ | HDOP: 1.2 ✅ | Fix: -0.123456,78.123456 ✅ Estable
🛰️ Satélites: 7 ✅ | HDOP: 1.1 ✅ | Fix: -0.123457,78.123457 ✅ Estable
🛰️ Satélites: 8 ✅ | HDOP: 0.9 ✅ | Fix: -0.123456,78.123456 ✅ Estable
```

**❌ CALIBRACIÓN PROBLEMÁTICA:**
```
🛰️ Satélites: 2 ❌ | HDOP: 5.2 ❌ | Sin Fix ❌
🛰️ Satélites: 3 ❌ | HDOP: 3.8 ⚠️ | Fix: -0.123456,78.123456 ❌ Inestable
🛰️ Satélites: 4 ✅ | HDOP: 4.1 ❌ | Fix: -0.125456,78.127456 ❌ Inestable
```

### 📊 Criterios de Buena Calibración

| Parámetro | Valor Óptimo | Descripción |
|-----------|--------------|-------------|
| **Satélites** | 4+ (ideal 6-12) | Mínimo para fix 3D confiable |
| **HDOP** | < 2.0 (ideal < 1.5) | Dilución horizontal de precisión |
| **Fix Estable** | Variación < 10m | Coordenadas consistentes |
| **Tiempo de Fix** | < 60s cold start | Tiempo hasta primera ubicación |

### 🔧 Pasos para Verificar Calibración

#### **Paso 1: Conexión Física**
```
GPS NEO-6M → ESP32 T-Call v1.4
VCC → 3.3V
GND → GND
TX  → GPIO 33 (GPS_TX_PIN)
RX  → GPIO 32 (GPS_RX_PIN)
```

#### **Paso 2: Posicionamiento**
- 🌞 **Cielo despejado** - Sin edificios, árboles o techos
- 📡 **Antena vertical** - Cerámica hacia arriba
- ⏰ **Tiempo de espera** - 5-30 minutos primera vez
- 🌍 **Ubicación fija** - No mover durante calibración

#### **Paso 3: Monitoreo en Arduino IDE**
1. Abrir Serial Monitor (115200 baud)
2. Subir código al ESP32
3. Observar salida de diagnóstico:

```
🔧 === DIAGNÓSTICO GPS NEO-6M ===
📡 Test 1: Comunicación serie GPS...
✅ GPS respondiendo - 1247 caracteres recibidos

📡 Test 2: Estado satelital...
🛰️ Satélites visibles: 6
📊 HDOP (precisión): 1.4
📍 Ubicación: -0.123456, -78.123456
✅ GPS con FIX!
```

#### **Paso 4: Verificación Completa (Opcional)**
Descomenta en `setup()`:
```cpp
verificarCalibracionGPS();
```

Esto ejecutará un análisis de 30 segundos:
```
🎯 === VERIFICACIÓN CALIBRACIÓN GPS ===
🔄 Monitoreando GPS por 30 segundos...

📊 === ANÁLISIS DE CALIBRACIÓN ===
🛰️ Máximo satélites detectados: 8
📍 Fixes GPS obtenidos: 47
📊 HDOP promedio: 1.2

🎯 ESTADO DE CALIBRACIÓN:
   Satélites (4+): ✅ OK (8)
   Precisión (<2.5): ✅ OK (1.2)
   Fixes estables: ✅ OK (47)

🎉 ✅ GPS CORRECTAMENTE CALIBRADO
   El módulo está listo para tracking
```

### 🚨 Problemas Comunes y Soluciones

#### **❌ "GPS no responde"**
```
❌ GPS no responde - Verificar:
   • Conexiones VCC(3.3V), GND, TX(33), RX(32)
   • Antena GPS conectada
   • Módulo alimentado correctamente
```
**Solución:** Verificar cables y alimentación

#### **❌ "Insuficientes satélites"**
```
⚠️ Insuficientes satélites (2/4 mín) - Colocar al aire libre
```
**Solución:** 
- Mover a cielo abierto
- Esperar 10-30 minutos
- Verificar antena

#### **❌ "HDOP muy alto"**
```
📊 HDOP (precisión): 4.8 ❌
```
**Solución:**
- Cambiar ubicación (menos obstáculos)
- Esperar más tiempo
- Reiniciar GPS

#### **❌ "Coordenadas inestables"**
```
Fix: -0.125456,78.127456 ❌ Inestable
```
**Solución:**
- No mover el dispositivo
- Verificar interferencia electromagnética
- Revisar calidad de antena

### ⏱️ Tiempos de Calibración Típicos

| Tipo de Start | Tiempo Esperado | Descripción |
|---------------|-----------------|-------------|
| **Cold Start** | 30-60 segundos | Primera vez / Sin datos previos |
| **Warm Start** | 10-30 segundos | Reinicio con datos parciales |
| **Hot Start** | 5-15 segundos | Reinicio reciente |

### 📍 Configuración Optimizada para Ecuador

El archivo `gps_config.h` incluye configuración específica:
```cpp
#define GPS_UPDATE_RATE_MS      200     // 5Hz para tracking
#define GPS_MIN_SATELLITES      4       // Mínimo para fix 3D
#define GPS_MIN_HDOP           2.5      // HDOP máximo aceptable
#define GPS_SBAS_ENABLED       1        // WAAS/EGNOS para mejor precisión
```

### 🎯 Señales de Calibración Exitosa

**✅ INMEDIATAS (0-5 minutos):**
- GPS responde en monitor serie
- Recibe datos NMEA ($GPGGA, $GPRMC)
- Detecta 1-3 satélites iniciales

**✅ INTERMEDIAS (5-15 minutos):**
- 4+ satélites detectados
- HDOP < 5.0
- Primeros fixes GPS

**✅ COMPLETA (15-30 minutos):**
- 6+ satélites estables
- HDOP < 2.0
- Coordenadas consistentes (< 10m variación)
- Fix en < 15 segundos tras reinicio

### 🔄 Si la Calibración Falla

1. **Reiniciar GPS:**
   ```cpp
   // En loop() para reset manual:
   ss.println("$PMTK104*37"); // Full cold restart
   ```

2. **Verificar ubicación geográfica:**
   - Ecuador: Latitud -4° a 2°, Longitud -81° a -75°
   - Coordenadas fuera de rango indican error

3. **Test con comando manual:**
   ```cpp
   ss.println("$PMTK605*31"); // Solicitar versión firmware
   ```

4. **Revisar alimentación:**
   - GPS NEO-6M necesita 3.3V estable
   - Consumo ~45mA durante búsqueda

### 📞 Debug Avanzado

Para debug detallado, activa en `gps_config.h`:
```cpp
#define GPS_RAW_NMEA_ENABLED    1  // Ver datos NMEA raw
```

Esto mostrará todas las sentencias NMEA:
```
$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47
$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A
```

¡Con esta guía podrás verificar completamente si tu GPS NEO-6M se está calibrando correctamente! 🎯
