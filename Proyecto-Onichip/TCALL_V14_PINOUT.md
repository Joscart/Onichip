# 📌 PINOUT LILYGO T-Call v1.4 - Configuración GPS

## 🔌 Mapa de Pines Usados

```
LILYGO T-Call v1.4 ESP32
┌─────────────────────────────────────┐
│  [USB]                              │
│                                     │
│  GPIO 0   ●                    ● 5V │
│  GPIO 2   ●                    ● GND│
│  GPIO 4   ● (SIM800 PWKEY)     ● 3V3│ ← Alimentación GPS
│  GPIO 5   ● (SIM800 RST)       ● 21 │ (I2C SDA)
│  GPIO 12  ●                    ● 22 │ (I2C SCL)
│  GPIO 13  ● (LED)              ● 23 │ (SIM800 POWER)
│  GPIO 14  ●                    ● 25 │
│  GPIO 15  ●                    ● 26 │ (SIM800 RX)
│  GPIO 16  ● (PSRAM - NO USAR)  ● 27 │ (SIM800 TX)
│  GPIO 17  ● (PSRAM - NO USAR)  ● 32 │ ← GPS RX (comandos)
│  GPIO 18  ●                    ● 33 │ ← GPS TX (datos)
│  GPIO 19  ●                    ● 34 │ (ADC - Batería)
│  GND      ●                    ● 35 │ (ADC)
│                                     │
└─────────────────────────────────────┘
```

## 🛰️ Conexiones GPS Recomendadas

### Opción 1: Pines 32/33 (RECOMENDADO)
```
GPS NEO-6M → T-Call v1.4
VCC (Rojo) → 3.3V
GND (Negro)→ GND  
TX (Blanco)→ GPIO 33
RX (Azul)  → GPIO 32
```

### Opción 2: Pines alternativos (si 32/33 no funcionan)
```
GPS NEO-6M → T-Call v1.4
VCC (Rojo) → 3.3V
GND (Negro)→ GND
TX (Blanco)→ GPIO 25
RX (Azul)  → GPIO 14
```

## ⚠️ Pines NO USAR en T-Call v1.4

### Ocupados por SIM800:
- **GPIO 4**: SIM800 PWKEY
- **GPIO 5**: SIM800 RST  
- **GPIO 23**: SIM800 POWER
- **GPIO 26**: SIM800 RX
- **GPIO 27**: SIM800 TX

### Ocupados por Sistema:
- **GPIO 16/17**: PSRAM (si está presente)
- **GPIO 0**: Boot mode
- **GPIO 2**: Boot mode  
- **GPIO 15**: Boot mode

### Ocupados por Sensores:
- **GPIO 21/22**: I2C (IP5306 - gestión batería)
- **GPIO 34/35**: ADC (lectura batería)
- **GPIO 13**: LED integrado

## 🔧 Pines Seguros Disponibles

### Para GPS (SoftwareSerial):
- **GPIO 32, 33**: ✅ Ideales (ADC capable)
- **GPIO 25, 14**: ✅ Alternativos
- **GPIO 12, 18**: ⚠️ Usar con cuidado (GPIO 12 puede afectar boot)

### Para Sensores Adicionales:
- **GPIO 19**: ✅ Disponible
- **GPIO 18**: ✅ Disponible (si no se usa para GPS)

## 📡 Configuración Actual del Código

```cpp
// config.h - Configuración actual
#define GPS_TX_PIN    33  // ESP32 RX ← GPS TX 
#define GPS_RX_PIN    32  // ESP32 TX → GPS RX
```

## 🔍 Verificación de Pines

### Test en Monitor Serie:
```cpp
void testPines() {
    pinMode(32, OUTPUT);
    pinMode(33, INPUT);
    
    digitalWrite(32, HIGH);
    Serial.printf("Pin 32 estado: %s\n", digitalRead(32) ? "HIGH" : "LOW");
    Serial.printf("Pin 33 disponible: %s\n", "SI");
}
```

### Salida Esperada:
```
Pin 32 estado: HIGH
Pin 33 disponible: SI
✅ Pines GPS listos para usar
```

## 🚨 Solución si los Pines No Funcionan

### Cambiar a pines alternativos:
1. Editar `config.h`:
```cpp
#define GPS_TX_PIN    25  // Cambiar a 25
#define GPS_RX_PIN    14  // Cambiar a 14
```

2. Reconectar GPS:
```
GPS TX → GPIO 25
GPS RX → GPIO 14
```

3. Recompilar y subir código

## 📐 Medidas Físicas T-Call v1.4

- **Tamaño**: 55mm x 25mm
- **Pines expuestos**: Laterales
- **Antena SIM**: Conector U.FL
- **Alimentación**: USB-C o batería 3.7V

## 🔋 Consideraciones de Alimentación

### GPS NEO-6M Consumo:
- **Búsqueda**: ~50mA @ 3.3V
- **Tracking**: ~25mA @ 3.3V
- **Standby**: ~5mA @ 3.3V

### T-Call v1.4 Límites:
- **Pin 3.3V**: Máximo 500mA
- **GPIO individual**: Máximo 40mA
- ✅ Suficiente para GPS NEO-6M
