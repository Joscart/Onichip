# 📱 GUÍA DE DIAGNÓSTICOS DE CONEXIÓN - ONICHIP GPS TRACKER

## 🎯 Funciones Implementadas

Tu ESP32 con Lilygo T-Call v1.4 + SIM800 + Movistar Ecuador ahora tiene capacidades completas de diagnóstico de conexión.

## 🚀 Funciones Automáticas en el Setup

Al arrancar el dispositivo, se ejecutan automáticamente:

1. **Test de Hardware** - Verifica memoria, I2C, pines
2. **Diagnóstico 2G** - Conexión completa Movistar Ecuador  
3. **Test Backend** - Conectividad al endpoint `/api/test`
4. **Diagnóstico de Reconexión** - Si falla alguna conexión
5. **Estado de Conexiones** - Resumen final

## 🔧 Comandos Manuales Disponibles

Durante el funcionamiento, puedes usar estos comandos desde el **Serial Monitor** (115200 baud):

### Comandos Básicos
```
help          - Mostrar ayuda completa
status        - Estado actual de todas las conexiones
```

### Diagnósticos de Conexión
```
2g            - Diagnóstico completo conexión 2G/Movistar
backend       - Test conectividad al backend (endpoint /api/test) 
reconectar    - Diagnóstico completo de reconexión
```

### Información Detallada
```
wifi          - Estado detallado WiFi
modem         - Información completa del módem SIM800
signal        - Calidad de señal móvil actual
gps           - Diagnóstico GPS NEO-6M
```

### Herramientas de Mantenimiento
```
reset         - Resetear módem SIM800
memoria       - Estado de memoria ESP32
```

## 📱 Diagnóstico 2G Movistar Ecuador

La función `diagnosticoConexion2G()` verifica:

### ✅ Verificaciones Automáticas
- **Comunicación AT** con SIM800
- **Estado de la SIM** (desbloqueada/PIN)
- **Registro en red Movistar**
- **Calidad de señal** (RSSI)
- **Configuración APN** `internet.movistar.ec`
- **Conexión GPRS** activa
- **IP asignada** por el operador

### 📊 Interpretación de Señal
- **RSSI ≥ 15**: Excelente
- **RSSI 10-14**: Buena  
- **RSSI 5-9**: Regular
- **RSSI 2-4**: Pobre
- **RSSI < 2**: Sin señal

## 🌐 Test de Conectividad Backend

La función `testConectividadBackend()` verifica:

### 🔍 Pruebas Realizadas
- **Conexión HTTP** al servidor `18.223.160.105:3000`
- **Endpoint `/api/test`** específico
- **Tiempo de respuesta** (latencia)
- **Códigos de error** HTTP detallados
- **Método de conexión** (WiFi o 2G)

### ⚠️ Códigos de Error Comunes
- **200**: ✅ Éxito total
- **404**: Endpoint no encontrado
- **500+**: Error del servidor
- **Connection Refused**: Servidor apagado
- **Timeout**: Servidor lento/sobrecargado

## 🔄 Diagnóstico de Reconexión

Cuando no hay internet, `diagnosticoReconexion()` ejecuta:

### 🛠️ Pasos Automáticos
1. **Análisis de estado** actual
2. **Reinicio de módem** SIM800
3. **Verificación de SIM**
4. **Búsqueda de operadores**
5. **Registro forzado** en red
6. **Reconexión GPRS**
7. **Test final** de internet

### 💡 Soluciones Sugeridas
- Cambiar ubicación física
- Verificar crédito/plan datos
- Contactar Movistar Ecuador
- Probar con otra SIM

## 📋 Estado de Conexiones

La función `mostrarEstadoConexion()` muestra:

### 📶 Información WiFi
- Estado de conexión
- IP asignada
- RSSI (calidad señal)
- SSID conectado

### 📱 Información Móvil
- Estado del módem SIM800
- Información de la SIM
- Operador (Movistar)
- Calidad de señal (0-31)
- Estado GPRS

### 💾 Información del Sistema
- Memoria libre ESP32
- Tiempo de funcionamiento
- Revisión del chip

## 🚨 Solución de Problemas Comunes

### ❌ Módem no responde
```
💡 Verificar:
   • Conexiones UART (TX:27, RX:26)  
   • Alimentación del SIM800
   • Reset del módem
```

### ❌ SIM no detectada
```
💡 Verificar:
   • SIM insertada correctamente
   • SIM no dañada
   • PIN correcto en config.h
```

### ❌ Sin señal móvil
```  
💡 Soluciones:
   • Mover a área con cobertura
   • Verificar antena SIM800
   • Alejar de interferencias
```

### ❌ GPRS falla
```
💡 Verificar:
   • Crédito en SIM
   • Plan de datos activo
   • APN: internet.movistar.ec
   • Cobertura 2G en zona
```

### ❌ Backend no accesible
```
💡 Verificar:
   • Servidor ejecutándose
   • IP: 18.223.160.105:3000
   • Endpoint /api/test existe
   • Firewall no bloquea
```

## 🎯 Uso Recomendado

### Al Instalar
1. Subir código al ESP32
2. Abrir Serial Monitor (115200)
3. Observar diagnósticos automáticos
4. Verificar que todo esté ✅

### Durante Funcionamiento
1. Si hay problemas, usar `status`
2. Para problemas 2G, usar `2g`
3. Para problemas backend, usar `backend`
4. Si no hay internet, usar `reconectar`

### Para Mantenimiento
- `signal` - Verificar calidad señal
- `memoria` - Verificar recursos
- `modem` - Info detallada SIM800
- `reset` - Reiniciar si es necesario

## 🔧 Configuración para Ecuador

El código está optimizado para:
- **Operador**: Movistar Ecuador (73402)
- **APN**: `internet.movistar.ec`
- **Frecuencias**: 2G 850/1900 MHz
- **Timezone**: UTC-5 (Ecuador)
- **Cobertura**: Optimizada para Quito

¡Tu rastreador GPS ahora tiene diagnósticos profesionales! 🎉
