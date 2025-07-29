// ====================== GPS_TRACKER.ino ======================
// 🗺️ SISTEMA DE RASTREO GPS ONICHIP
// Funciones principales: GPS + WiFi Fallback + Geofencing

// Selección de módem SIM800 para TinyGSM
#define TINY_GSM_MODEM_SIM800

#include "config.h"
#include "gps_config.h"

#include <Wire.h>
#include <TinyGsmClient.h>
#include <TinyGPSPlus.h>
#include <SoftwareSerial.h>
#include <HTTPClient.h>
#include <SPIFFS.h>
#include <WiFi.h>
#include <ArduinoJson.h>

#define TINY_GSM_RX_BUFFER 1024

// UART y cliente TinyGSM
HardwareSerial SerialAT(2);
TinyGsm        modem(SerialAT);
TinyGsmClient  client(modem);
TinyGPSPlus gps;
SoftwareSerial ss(GPS_TX_PIN, GPS_RX_PIN); // GPS TX → ESP32 RX, GPS RX ← ESP32 TX

// Configuración API (ver config.h)
String deviceId = DEVICE_ID;
String apiBase = API_BASE;

// =================== [WIFI GPS FALLBACK] ===================
#define TEST_WIFI;
#include "test.h"
#include <WiFi.h>
String wifiApiKey = ""; // Se configurará desde el servidor
bool useWifiLocation = false;
// =================== [END WIFI GPS FALLBACK] ===================

// Estados de conexión
enum ConnStatus { CONN_OK = 0, NO_NETWORK, GPRS_FAIL };
enum LocationMethod { GPS_ONLY, WIFI_FALLBACK, HYBRID_MODE };
enum ConnType { CONN_NONE = 0, CONN_WIFI, CONN_2G };

// Variables de estado de conexión
ConnType currentConnection = CONN_NONE;
bool isConnectedToInternet = false;

// Constantes para geolocalización GSM
#define MAX_WIFI_NETWORKS   15    // Máximo redes WiFi a incluir
#define MIN_RSSI_THRESHOLD -85    // Umbral mínimo RSSI para WiFi
#define GSM_TIMEOUT_MS     5000   // Timeout para comandos GSM
#define DEFAULT_LAC        "100"  // LAC específico para Quito (Zona Norte)
#define DEFAULT_CELLID     "2010" // Cell ID realista para área metropolitana de Quito
#define DEFAULT_MCC        "740"  // Ecuador (código oficial)
#define DEFAULT_MNC        "0"    // Movistar Ecuador (operador por defecto)

// Estructura para datos GPS mejorados
struct LocationData {
    float latitude;
    float longitude;
    float speed;
    float accuracy;
    int satellites;
    LocationMethod method;
    bool isValid;
    unsigned long timestamp;
};

// Estructura para datos GSM de torres celulares
struct GSMData {
    String mcc = "";
    String mnc = "";
    String lac = "";
    String cellId = "";
    int signalStrength = 0;
    bool isValid = false;
};

// Protos GPS y WiFi
bool        setPowerBoostKeepOn(bool en);
float       readBatteryLevel();
bool        readChargingStatus();

// === NUEVOS MÉTODOS DE CONECTIVIDAD ===
ConnType    connect();                    // Establecer conexión (WiFi → 2G)
void        disconnect();                 // Desconectar todas las redes
bool        checkConnection();            // Solo verificar conexión actual con backend
ConnStatus  checkConnectionLegacy();     // Función legacy para compatibilidad
bool        sendData(String json);       // Envío de datos con validación
bool        sendLocationData(LocationData &location, float batV, bool charging); // Envío de ubicación
// === FIN NUEVOS MÉTODOS ===

// =================== IMPLEMENTACIÓN NUEVOS MÉTODOS ===================

// — Establecer conexión con prioridad WiFi → 2G
ConnType connect() {
    Serial.println("🔗 Estableciendo conexión...");
    
    // MÉTODO 1: Intentar WiFi primero
    #ifdef TEST_WIFI
    Serial.println("🌐 Intentando conexión WiFi...");
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n✅ WiFi conectado: " + WiFi.localIP().toString());
        currentConnection = CONN_WIFI;
        isConnectedToInternet = true;
        return CONN_WIFI;
    } else {
        Serial.println("\n⚠️ WiFi no disponible, intentando 2G...");
        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
        delay(1000);
    }
    #else
    Serial.println("⚠️ TEST_WIFI no definido, usando solo 2G");
    #endif
    
    // MÉTODO 2: Usar datos móviles como fallback
    Serial.println("📡 Conectando datos móviles 2G...");
    
    // Verificar conexión de red móvil
    if (!modem.isNetworkConnected()) {
        Serial.println("❌ Sin señal de red móvil");
        currentConnection = CONN_NONE;
        isConnectedToInternet = false;
        return CONN_NONE;
    }
    
    // Verificar/establecer conexión GPRS
    if (!modem.isGprsConnected()) {
        Serial.println("🔄 Conectando GPRS...");
        if (!modem.gprsConnect(GPRS_APN, GPRS_USER, GPRS_PASS)) {
            Serial.println("❌ Fallo GPRS");
            currentConnection = CONN_NONE;
            isConnectedToInternet = false;
            return CONN_NONE;
        }
    }
    
    Serial.println("✅ Conectado vía datos móviles 2G");
    currentConnection = CONN_2G;
    isConnectedToInternet = true;
    return CONN_2G;
}

// — Desconectar todas las redes (estado idle)
void disconnect() {
    Serial.println("🔌 Desconectando todas las redes...");
    
    // Desconectar WiFi si está activo
    if (WiFi.getMode() != WIFI_OFF) {
        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
        Serial.println("📴 WiFi desconectado");
    }
    
    // Desconectar GPRS si está activo
    if (modem.isGprsConnected()) {
        modem.gprsDisconnect();
        Serial.println("📴 GPRS desconectado");
    }
    
    currentConnection = CONN_NONE;
    isConnectedToInternet = false;
    Serial.println("✅ Sistema en modo idle - Sin conexiones activas");
}

// — Verificar conexión actual con backend (sin debug molesto)
bool checkConnection() {
    if (!isConnectedToInternet) {
        return false;
    }
    
    // Test rápido de conectividad al backend
    HTTPClient http;
    String testUrl = apiBase + "/api/health";
    
    http.begin(testUrl);
    http.setTimeout(5000); // Timeout corto para verificación
    
    int httpCode = http.GET();
    http.end();
    
    bool connected = (httpCode == 200 || httpCode == 404); // 404 también indica conectividad
    
    if (!connected) {
        isConnectedToInternet = false;
        currentConnection = CONN_NONE;
    }
    
    return connected;
}

// — Envío de datos genérico con validación
bool sendData(String json) {
    if (!isConnectedToInternet) {
        Serial.println("❌ Sin conexión a internet");
        return false;
    }
    
    HTTPClient http;
    String endpoint = apiBase + "/api/device/" + deviceId + "/location";
    
    http.begin(endpoint);
    http.addHeader("Content-Type", "application/json");
    
    // Configurar según tipo de conexión
    if (currentConnection == CONN_WIFI) {
        http.addHeader("User-Agent", "OniChip-ESP32-WiFi/1.0");
        http.setTimeout(10000); // 10s para WiFi
        Serial.println("📶 Enviando vía WiFi...");
    } else if (currentConnection == CONN_2G) {
        http.addHeader("User-Agent", "OniChip-ESP32-2G/1.0");
        http.setTimeout(20000); // 20s para 2G
        Serial.println("📡 Enviando vía datos móviles 2G...");
    }
    
    int httpCode = http.PUT(json);
    String response = http.getString();
    http.end();
    
    if (httpCode == 200) {
        Serial.println("✅ Datos enviados correctamente");
        return true;
    } else {
        Serial.printf("❌ Error envío HTTP %d\n", httpCode);
        
        // Manejar errores específicos
        if (httpCode == -1) {
            Serial.println("💡 Error de conexión TCP/DNS");
        } else if (httpCode == -5) {
            Serial.println("💡 Timeout de conexión");
        }
        
        // Marcar como desconectado si hay errores graves
        if (httpCode == -1 || httpCode == -5) {
            isConnectedToInternet = false;
        }
        
        return false;
    }
}

// — Envío específico de datos de ubicación
bool sendLocationData(LocationData &location, float batV, bool charging) {
    String json = buildLocationJson(location, batV, charging);
    return sendData(json);
}

// — Función checkConnection legacy para compatibilidad con funciones de diagnóstico
ConnStatus checkConnectionLegacy() {
    Serial.println("🔍 Verificando conectividad (WiFi → 2G) [Legacy]...");
    
    // MÉTODO 1: Intentar WiFi primero (si está configurado)
    #ifdef TEST_WIFI
    Serial.println("🌐 Método 1: Verificando WiFi...");
    
    if (WiFi.getMode() == WIFI_OFF) {
        WiFi.mode(WIFI_STA);
        WiFi.begin(ssid, password);
        
        int attempts = 0;
        while (WiFi.status() != WL_CONNECTED && attempts < 10) {
            delay(500);
            Serial.print(".");
            attempts++;
        }
        
        if (WiFi.status() == WL_CONNECTED) {
            Serial.println("\n✅ WiFi conectado: " + WiFi.localIP().toString());
            return CONN_OK;
        } else {
            Serial.println("\n⚠️ WiFi no disponible, probando datos móviles...");
            WiFi.disconnect(true);
            WiFi.mode(WIFI_OFF);
            delay(1000);
        }
    } else if (WiFi.status() == WL_CONNECTED) {
        Serial.println("✅ WiFi ya conectado: " + WiFi.localIP().toString());
        return CONN_OK;
    }
    #else
    Serial.println("⚠️ TEST_WIFI no definido, usando solo datos móviles");
    #endif
    
    // MÉTODO 2: Usar datos móviles como fallback
    Serial.println("📡 Método 2: Verificando datos móviles...");
    
    // Asegurar que WiFi esté deshabilitado para datos móviles
    if (WiFi.getMode() != WIFI_OFF) {
        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
        delay(1000);
    }

    // Verificar conexión de red móvil
    if (!modem.isNetworkConnected()) {
        Serial.println("❌ Sin señal de red móvil");
        return NO_NETWORK;
    }
    
    // Verificar conexión GPRS
    if (!modem.isGprsConnected()) {
        Serial.println("🔄 Conectando GPRS...");
        if (!modem.gprsConnect(GPRS_APN, GPRS_USER, GPRS_PASS)) {
            Serial.println("❌ Fallo GPRS - Verificar APN y crédito");
            return GPRS_FAIL;
        }
        Serial.println("✅ GPRS conectado");
    }
    
    Serial.println("✅ Conectado vía datos móviles 2G");
    return CONN_OK;
}

void        reconnect();
void        blinkError(int code);
void        blinkConnected();
bool        readGPS(LocationData &location); // GPS principal
bool        getWiFiLocation(LocationData &location); // WiFi fallback
bool        getGSMCellInfo(GSMData &gsmData); // Auxiliar GSM
bool        readLocationHybrid(LocationData &location); // Método híbrido
void        sendLocationData(LocationData &location);
void        readAllData(LocationData &location, float &batV, bool &charging);
void        sendData(float lat, float lon, float speedKmh,
                     int vitals, float batV, bool charging);
void        diagnosticoGPS(); // Diagnóstico GPS NEO-6M
void        verificarCalibracionGPS(); // Verificación específica de calibración
bool        testHardware(); // Test inicial de hardware
bool        diagnosticoConexion2G(); // Diagnóstico completo 2G/móvil
bool        testConectividadBackend(); // Test conectividad al backend
void        diagnosticoReconexion(); // Diagnóstico y guía de reconexión
void        mostrarEstadoConexion(); // Mostrar estado actual de todas las conexiones
void        procesarComandosDiagnostico(); // Procesar comandos de diagnóstico desde Serial


void setup() {
  Serial.begin(115200);
  delay(10);
  
  // Mensaje de arranque seguro
  Serial.println("\n🚀 === ONICHIP GPS TRACKER INICIANDO ===");
  Serial.println("⚠️  Versión: 2.0 - Boot Seguro");
  
  SPIFFS.begin(true);

  // =================== [TEST WIFI SECTION - REMOVE FOR PRODUCTION] ===================
  // Modular: solo incluye y llama si TEST_WIFI está definido
  connectTestWiFi();
  // =================== [END TEST WIFI SECTION] ===================

  // CRÍTICO: Test de hardware ANTES de cualquier inicialización
  if (!testHardware()) {
    Serial.println("❌ FALLO EN TEST DE HARDWARE - DETENIENDO");
    while(1) {
      blinkError(5);
      delay(2000);
    }
  }

  // IP5306: mantener boost ON
  Wire.begin(I2C_SDA_POWER, I2C_SCL_POWER);
  bool ok = setPowerBoostKeepOn(true);
  Serial.println(String("IP5306 KeepOn ") + (ok ? "OK" : "FAIL"));

  // Pines de control del SIM800L
  pinMode(MODEM_PWKEY_PIN, OUTPUT);
  pinMode(MODEM_RST_PIN, OUTPUT);
  pinMode(MODEM_POWERON_PIN, OUTPUT);
  digitalWrite(MODEM_PWKEY_PIN, LOW);
  digitalWrite(MODEM_RST_PIN, HIGH);
  digitalWrite(MODEM_POWERON_PIN, HIGH);
  delay(100);

  // LED de estado
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);
  
  Serial.println("🔧 Sistema iniciando - Verificando hardware...");
  
  // IMPORTANTE: Dar tiempo al sistema para estabilizarse
  delay(2000);
  Serial.println("✅ Sistema estabilizado");

  // Inicia UART al SIM800L
  SerialAT.begin(115200, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
  delay(3000);
  Serial.println("Iniciando módem...");
  modem.restart();
  
  Serial.println("🛰️ === INICIALIZACIÓN GPS SEGURA ===");
  
  // Configurar pines GPS como entrada/salida de forma segura
  pinMode(GPS_TX_PIN, INPUT);   // Pin que recibe datos del GPS
  pinMode(GPS_RX_PIN, OUTPUT);  // Pin que envía comandos al GPS
  digitalWrite(GPS_RX_PIN, HIGH); // Estado idle
  
  delay(500); // Pausa para estabilizar
  
  // Inicializar SoftwareSerial GPS con configuración segura
  ss.begin(9600, SWSERIAL_8N1, GPS_TX_PIN, GPS_RX_PIN, false, 256);
  
  Serial.printf("✅ GPS inicializado en pines TX:%d RX:%d\n", GPS_TX_PIN, GPS_RX_PIN);
  Serial.println("📡 Configurando GPS NEO-6M para Ecuador...");
  
  // 1. Configurar tasa de actualización (5Hz para tracking rápido)
  ss.println(CMD_UPDATE_RATE);
  delay(200);
  Serial.println("✓ Tasa: 5Hz");
  
  // 2. Configurar solo sentencias GPS esenciales (GGA, RMC)
  ss.println(CMD_NMEA_OUTPUT);
  delay(200);
  Serial.println("✓ Sentencias: GGA+RMC");
  
  // 3. Activar SBAS para mejor precisión
  ss.println(CMD_SBAS_ON);
  delay(200);
  Serial.println("✓ SBAS: Habilitado");
  
  // 4. Configurar para modo tracking dinámico
  ss.println(CMD_DYNAMIC_MODEL);
  delay(200);
  Serial.println("✓ Modo: Tracking dinámico");
  
  // 5. Establecer datum WGS84
  ss.println(CMD_DATUM_WGS84);
  delay(200);
  Serial.println("✓ Datum: WGS84");
  
  // 6. Configurar antena activa
  ss.println(CMD_ANTENNA_ON);
  delay(200);
  Serial.println("✓ Antena: Activa");
  
  Serial.println("✅ GPS NEO-6M configurado para Ecuador - Esperando fix satelital...");
  
  // Ejecutar diagnóstico GPS inicial
  diagnosticoGPS();
  
  // NUEVO: Diagnóstico completo de conexión 2G
  Serial.println("\n🚀 === DIAGNÓSTICOS DE CONECTIVIDAD ===");
  
  // 1. Diagnóstico conexión 2G/móvil
  bool conexion2GOK = diagnosticoConexion2G();
  
  if (conexion2GOK) {
    Serial.println("✅ Conexión 2G establecida correctamente");
    
    // 2. Test de conectividad al backend
    bool backendOK = testConectividadBackend();
    
    if (backendOK) {
      Serial.println("🎉 Sistema completamente funcional y conectado");
    } else {
      Serial.println("⚠️ Conexión 2G OK, pero problemas con backend");
      Serial.println("💡 El sistema funcionará, pero verifique el servidor");
    }
  } else {
    Serial.println("❌ Problemas con conexión 2G");
    Serial.println("🔧 Ejecutando diagnóstico de reconexión...");
    diagnosticoReconexion();
  }
  
  // 3. Mostrar estado final
  mostrarEstadoConexion();
  
  Serial.println("🚀 === FIN DIAGNÓSTICOS INICIALES ===\n");
  
  // Verificar calibración GPS (opcional - descomenta para testing)
  // verificarCalibracionGPS();

  // Desbloquea SIM si tiene PIN
  if (strlen(SIM_PIN) && modem.getSimStatus() != 3) {
    modem.simUnlock(SIM_PIN);
  }
  // Activa GPS interno
  modem.sendAT(GF("+CGNSPWR=1"));
  modem.waitResponse();

  // Usar deviceId y apiBase desde config.h para producción
  Serial.println("DeviceId (config): " + deviceId);
  Serial.println("API Base (config): " + apiBase);
}

void loop() {
  // ✨ MANTENER: Procesar comandos de diagnóstico desde Serial Monitor
  procesarComandosDiagnostico();
  
  // ======= NUEVA LÓGICA: CONEXIÓN → ENVÍO → DESCONEXIÓN =======
  
  // PASO 1: Establecer conexión
  Serial.println("\n🔗 === INICIANDO CICLO DE TRANSMISIÓN ===");
  ConnType connectionType = connect();
  
  if (connectionType == CONN_NONE) {
    Serial.println("❌ Sin conectividad disponible - Esperando 30s...");
    blinkError(2); // Parpadeo de error
    delay(30000);
    return;
  }
  
  // PASO 2: Leer y enviar datos mientras hay conexión
  unsigned long cycleStart = millis();
  unsigned long sendInterval = 30000; // 30 segundos entre envíos
  unsigned long lastSend = 0;
  bool transmissionActive = true;
  
  Serial.printf("✅ Conexión establecida vía %s - Iniciando transmisiones\n", 
                connectionType == CONN_WIFI ? "WiFi" : "2G");
  
  while (transmissionActive && (millis() - cycleStart < 300000)) { // Max 5 minutos por ciclo
    // ✨ MANTENER: Procesar comandos durante transmisión
    procesarComandosDiagnostico();
    
    // Verificar si es tiempo de enviar
    if (millis() - lastSend >= sendInterval) {
      // Verificar conexión antes de enviar
      if (!checkConnection()) {
        Serial.println("❌ Conexión perdida durante transmisión");
        transmissionActive = false;
        break;
      }
      
      // Leer datos actuales
      LocationData location;
      float batV;
      bool charging;
      readAllData(location, batV, charging);
      
      // Enviar datos de ubicación
      bool sendSuccess = sendLocationData(location, batV, charging);
      
      if (sendSuccess) {
        blinkConnected(); // Parpadeo de éxito
        Serial.printf("� Transmisión exitosa - Próximo envío en %ds\n", sendInterval/1000);
      } else {
        Serial.println("⚠️ Fallo en transmisión - Continuando...");
        blinkError(1);
      }
      
      lastSend = millis();
    }
    
    // Pausa pequeña para no saturar CPU
    delay(100);
  }
  
  // PASO 3: Desconectar y entrar en modo idle
  Serial.println("🔌 Finalizando ciclo de transmisión");
  disconnect();
  
  // MANTENER: Debug de estado final
  Serial.printf("💤 Entrando en modo idle por 30s (Ciclo duró %lus)\n", 
                (millis() - cycleStart) / 1000);
  
  delay(30000); // Pausa antes del siguiente ciclo
  
  Serial.println("🔄 === FIN CICLO - REINICIANDO ===\n");
}

String buildJson(float lat, float lon, float speedKmh, int vitals, float batV, bool charging) {
  String json = "{";
  json += "\"bateria\":{";
  json += "\"voltaje\":" + String(batV, 2) + ",";
  json += "\"cargando\":" + String(charging ? "true" : "false") + "},";
  json += "\"sensores\":[";
  json += "{\"tipo\":\"gps\",\"valores\":[" + String(lat, 6) + "," + String(lon, 6) + "," + String(speedKmh, 2) + "]},";
  json += "{\"tipo\":\"vitales\",\"valores\":[" + String(vitals) + "]}";
  json += "]}";
  return json;
}

// — Mantener booster ON
bool setPowerBoostKeepOn(bool en) {
  Wire.beginTransmission(IP5306_ADDR);
  Wire.write(IP5306_REG_SYS_CTL0);
  Wire.write(en ? 0x37 : 0x35);
  return Wire.endTransmission() == 0;
}

// — Nivel de batería (V)
float readBatteryLevel() {
  uint16_t raw = analogRead(BATT_PIN);
  return raw * (3.3f / 4095.0f) * 2.0f;
}

// — Estado de carga (bit 5 de reg 0x01)
bool readChargingStatus() {
  Wire.beginTransmission(IP5306_ADDR);
  Wire.write(0x01);
  Wire.endTransmission();
  Wire.requestFrom(IP5306_ADDR, 1);
  uint8_t reg = Wire.read();
  return reg & (1 << 5);
}

// — Chequea conexión con fallback WiFi → Datos Móviles
// — Reconectar según fallo con fallback WiFi → 2G (DEPRECATED - mantener para comandos de diagnóstico)
void reconnect() {
  Serial.println("\n🔄 === PROCESO DE RECONEXIÓN ===");
  
  ConnStatus st = checkConnectionLegacy(); // Usar función legacy
  
  if (st == NO_NETWORK) {
    Serial.println("� Sin red móvil - Reiniciando módem completo...");
    
    // Asegurar que WiFi esté apagado antes del reset del módem
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    delay(1000);
    
    // Reset completo del módem
    digitalWrite(MODEM_POWERON_PIN, LOW);
    delay(1000);
    digitalWrite(MODEM_RST_PIN, LOW);
    delay(100);
    digitalWrite(MODEM_RST_PIN, HIGH);
    delay(1000);
    digitalWrite(MODEM_POWERON_PIN, HIGH);
    delay(5000);
    
    // Reiniciar módem vía software
    modem.restart();
    delay(3000);
    
    // Verificar comunicación AT
    if (modem.testAT()) {
      Serial.println("✅ Módem reiniciado correctamente");
    } else {
      Serial.println("❌ Error en reinicio del módem");
    }
  }
  
  if (st == GPRS_FAIL) {
    Serial.println("🔧 Fallo GPRS - Reintentando conexión...");
    
    // Desconectar GPRS actual
    modem.gprsDisconnect();
    delay(2000);
    
    // Configurar APN nuevamente
    Serial.println("🔧 Reconfigurando APN...");
    
    // Usar comandos AT directos para mayor control
    SerialAT.println("AT+SAPBR=0,1"); // Cerrar bearer si existe
    delay(1000);
    
    SerialAT.println("AT+SAPBR=3,1,\"CONTYPE\",\"GPRS\"");
    delay(500);
    SerialAT.println("AT+SAPBR=3,1,\"APN\",\"" + String(GPRS_APN) + "\"");
    delay(500);
    
    if (strlen(GPRS_USER) > 0) {
      SerialAT.println("AT+SAPBR=3,1,\"USER\",\"" + String(GPRS_USER) + "\"");
      delay(500);
    }
    if (strlen(GPRS_PASS) > 0) {
      SerialAT.println("AT+SAPBR=3,1,\"PWD\",\"" + String(GPRS_PASS) + "\"");
      delay(500);
    }
    
    // Intentar conexión GPRS
    SerialAT.println("AT+SAPBR=1,1");
    delay(8000); // Tiempo extendido para conexión
    
    // Verificar estado
    SerialAT.println("AT+SAPBR=2,1");
    delay(2000);
    String response = "";
    while (SerialAT.available()) {
      response += SerialAT.readString();
    }
    
    if (response.indexOf("1,1,") >= 0) {
      Serial.println("✅ GPRS reconectado exitosamente");
      
      // Mostrar IP asignada
      int ipStart = response.indexOf("1,1,\"") + 5;
      int ipEnd = response.indexOf("\"", ipStart);
      if (ipStart > 4 && ipEnd > ipStart) {
        String ip = response.substring(ipStart, ipEnd);
        Serial.println("📱 Nueva IP asignada: " + ip);
      }
    } else {
      Serial.println("❌ Fallo en reconexión GPRS");
      Serial.println("💡 Posibles problemas:");
      Serial.println("   • Crédito agotado en SIM");
      Serial.println("   • Plan de datos vencido");
      Serial.println("   • Problemas de cobertura");
      Serial.println("   • APN incorrecto");
    }
    
    // Intentar conexión TinyGSM como respaldo
    if (!modem.isGprsConnected()) {
      Serial.println("🔄 Intentando con TinyGSM...");
      bool gprsResult = modem.gprsConnect(GPRS_APN, GPRS_USER, GPRS_PASS);
      if (gprsResult) {
        Serial.println("✅ GPRS conectado vía TinyGSM");
      } else {
        Serial.println("❌ Fallo total en conexión GPRS");
      }
    }
  }
  
  Serial.println("🔄 === FIN PROCESO RECONEXIÓN ===\n");
}

// — Parpadeo de error “code” veces
void blinkError(int code) {
  for (int i = 0; i < code; i++) {
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(BLINK_ON_MS);
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(BLINK_OFF_MS);
  }
  delay(ERROR_PAUSE_MS);
}

// — Parpadeo OK
void blinkConnected() {
  digitalWrite(STATUS_LED_PIN, HIGH);
  delay(OK_ON_MS);
  digitalWrite(STATUS_LED_PIN, LOW);
  delay(OK_OFF_MS);
}

// 🗺️ FUNCIONES GPS MEJORADAS CON WIFI FALLBACK

// — Lectura GPS principal con configuración mejorada para NEO-6M
bool readGPS(LocationData &location) {
    location.isValid = false;
    location.method = GPS_ONLY;
    location.timestamp = millis();
    
    // Timeouts configurables según estado del GPS
    static bool coldStart = true;
    unsigned long timeoutMs;
    
    if (coldStart) {
        timeoutMs = GPS_COLD_START_TIMEOUT_MS; // 30s para primer fix
        Serial.println("🛰️ GPS Cold Start - Buscando satélites...");
    } else {
        timeoutMs = GPS_WARM_START_TIMEOUT_MS; // 10s para fix normal
        Serial.println("🛰️ GPS Warm Start - Actualizando posición...");
    }
    
    // Leer datos GPS durante el tiempo especificado
    unsigned long start = millis();
    int lastSatCount = 0;
    
    while (millis() - start < timeoutMs) {
        while (ss.available() > 0) {
            char c = ss.read();
            
            #if GPS_RAW_NMEA_ENABLED
            Serial.print(c); // Debug: mostrar datos NMEA raw
            #endif
            
            if (gps.encode(c)) {
                // Verificar progreso de satélites
                if (gps.satellites.isValid()) {
                    int currentSats = gps.satellites.value();
                    if (currentSats != lastSatCount) {
                        Serial.printf("🔍 Satélites: %d/%d ", currentSats, GPS_MIN_SATELLITES);
                        if (gps.hdop.isValid()) {
                            Serial.printf("| HDOP: %.2f", gps.hdop.hdop());
                        }
                        Serial.println();
                        lastSatCount = currentSats;
                    }
                }
                
                // Verificar si tenemos fix válido
                if (gps.location.isValid() && gps.satellites.isValid()) {
                    // Verificar calidad del fix
                    int sats = gps.satellites.value();
                    float hdop = gps.hdop.isValid() ? gps.hdop.hdop() : 999.0;
                    
                    if (sats >= GPS_MIN_SATELLITES && hdop <= GPS_MIN_HDOP) {
                        location.latitude = gps.location.lat();
                        location.longitude = gps.location.lng();
                        location.speed = gps.speed.isValid() ? gps.speed.kmph() : 0.0;
                        location.accuracy = hdop;
                        location.satellites = sats;
                        location.isValid = true;
                        location.method = GPS_ONLY;
                        
                        coldStart = false; // GPS ya inicializado
                        
                        Serial.printf("🎯 GPS FIX! Lat: %.6f, Lon: %.6f\n", location.latitude, location.longitude);
                        Serial.printf("📊 Vel: %.2f km/h | Sats: %d | HDOP: %.2f\n", 
                                      location.speed, sats, hdop);
                        return true;
                    } else {
                        #if GPS_DEBUG_ENABLED
                        Serial.printf("⚠️ Fix de baja calidad - Sats: %d, HDOP: %.2f\n", sats, hdop);
                        #endif
                    }
                }
            }
        }
        delay(10); // Pequeña pausa para no saturar el CPU
    }
    
    // Información de estado si no hay fix
    if (gps.satellites.isValid()) {
        int sats = gps.satellites.value();
        Serial.printf("❌ GPS sin fix - Satélites: %d/%d", sats, GPS_MIN_SATELLITES);
        if (gps.hdop.isValid()) {
            Serial.printf(" | HDOP: %.2f", gps.hdop.hdop());
        }
        Serial.println();
        
        if (sats < GPS_MIN_SATELLITES) {
            Serial.println("💡 Consejo: Mover a área abierta sin obstáculos");
        }
    } else {
        Serial.println("❌ GPS no responde - Verificar conexiones y antena");
    }
    
    #if GPS_DEBUG_ENABLED
    Serial.printf("📊 GPS Stats - Chars: %d, Sentences: %d, Fails: %d\n",
                  gps.charsProcessed(), gps.sentencesWithFix(), gps.failedChecksum());
    #endif
    
    return false;
}

// Función auxiliar para obtener datos GSM de manera robusta
bool getGSMCellInfo(GSMData &gsmData) {
    if (!modem.isNetworkConnected()) {
        Serial.println("📡 GSM no conectado a red");
        return false;
    }
    
    Serial.println("🔍 Obteniendo información de torre GSM...");
    
    // Método 1: Intentar obtener info completa con AT+CENG
    Serial.println("📋 Método 1: AT+CENG (info detallada)");
    SerialAT.println("AT+CENG=1,1");
    delay(1000);
    
    SerialAT.println("AT+CENG?");
    delay(2000);
    
    String response = "";
    unsigned long startTime = millis();
    while (SerialAT.available() && (millis() - startTime) < GSM_TIMEOUT_MS) {
        response += SerialAT.readString();
        delay(100);
    }
    
    if (response.length() > 0) {
        Serial.println("📦 Respuesta CENG: " + response);
        
        // Buscar patrón: +CENG: 0,"lac,cellid,rxlev,mcc,mnc,..."
        int quoteStart = response.indexOf("\"") + 1;
        int quoteEnd = response.indexOf("\"", quoteStart);
        
        if (quoteStart > 0 && quoteEnd > quoteStart) {
            String cellData = response.substring(quoteStart, quoteEnd);
            
            // Dividir por comas: LAC,CellID,RxLev,MCC,MNC,...
            int positions[6] = {-1, -1, -1, -1, -1, -1};
            int commaCount = 0;
            
            for (int i = 0; i < cellData.length() && commaCount < 6; i++) {
                if (cellData.charAt(i) == ',') {
                    positions[commaCount++] = i;
                }
            }
            
            if (commaCount >= 4) {
                gsmData.lac = cellData.substring(0, positions[0]);
                gsmData.cellId = cellData.substring(positions[0] + 1, positions[1]);
                gsmData.mcc = cellData.substring(positions[3] + 1, positions[4]);
                gsmData.mnc = cellData.substring(positions[4] + 1, 
                               commaCount > 4 ? positions[5] : cellData.length());
                
                // Limpiar datos (remover espacios y caracteres no numéricos)
                gsmData.lac.trim();
                gsmData.cellId.trim();
                gsmData.mcc.trim();
                gsmData.mnc.trim();
                
                // Validar que tenemos datos numéricos
                if (gsmData.mcc.length() >= 3 && gsmData.mnc.length() >= 1 && 
                    gsmData.lac.length() >= 1 && gsmData.cellId.length() >= 1) {
                    gsmData.isValid = true;
                    Serial.printf("✅ CENG OK: MCC=%s, MNC=%s, LAC=%s, Cell=%s\n",
                                 gsmData.mcc.c_str(), gsmData.mnc.c_str(), 
                                 gsmData.lac.c_str(), gsmData.cellId.c_str());
                }
            }
        }
    }
    
    // Método 2: Si CENG falló, usar AT+COPS para MCC/MNC básico
    if (!gsmData.isValid) {
        Serial.println("📋 Método 2: AT+COPS (info básica)");
        SerialAT.println("AT+COPS?");
        delay(1500);
        
        response = "";
        startTime = millis();
        while (SerialAT.available() && (millis() - startTime) < GSM_TIMEOUT_MS) {
            response += SerialAT.readString();
            delay(100);
        }
        
        if (response.length() > 0) {
            Serial.println("📦 Respuesta COPS: " + response);
            
            // Buscar formato: +COPS: 0,2,"73402" o +COPS: 0,0,"Claro CO","73402"
            int lastQuoteStart = response.lastIndexOf("\"") - 5; // Retroceder para encontrar el código
            if (lastQuoteStart < 0) lastQuoteStart = response.indexOf("\"") + 1;
            int lastQuoteEnd = response.lastIndexOf("\"");
            
            if (lastQuoteStart >= 0 && lastQuoteEnd > lastQuoteStart) {
                String operatorCode = response.substring(lastQuoteStart, lastQuoteEnd);
                operatorCode.trim();
                
                if (operatorCode.length() >= 5) { // MCC(3) + MNC(2+)
                    gsmData.mcc = operatorCode.substring(0, 3);
                    gsmData.mnc = operatorCode.substring(3);
                    gsmData.lac = DEFAULT_LAC;
                    gsmData.cellId = DEFAULT_CELLID;
                    gsmData.isValid = true;
                    
                    // Identificar operador específico para Ecuador
                    String operadorNombre = "Desconocido";
                    if (gsmData.mcc == "740") { // Ecuador
                        if (gsmData.mnc == "1") operadorNombre = "Claro Ecuador";
                        else if (gsmData.mnc == "0") operadorNombre = "Movistar Ecuador";
                        else if (gsmData.mnc == "2") operadorNombre = "CNT Mobile";
                        else if (gsmData.mnc == "3") operadorNombre = "Tuenti Ecuador";
                    }
                    
                    Serial.printf("✅ COPS OK: %s (MCC=%s, MNC=%s) + defaults Quito\n",
                                 operadorNombre.c_str(), gsmData.mcc.c_str(), gsmData.mnc.c_str());
                } else {
                    // Si COPS también falla, usar valores por defecto específicos de Quito
                    Serial.println("⚠️ COPS falló, usando valores específicos de Quito...");
                    gsmData.mcc = DEFAULT_MCC;
                    gsmData.mnc = DEFAULT_MNC;
                    gsmData.lac = DEFAULT_LAC;
                    gsmData.cellId = DEFAULT_CELLID;
                    gsmData.isValid = true;
                    
                    Serial.printf("⚠️ Defaults Quito: Movistar Ecuador (MCC=%s, MNC=%s, LAC=%s, Cell=%s)\n",
                                 gsmData.mcc.c_str(), gsmData.mnc.c_str(), 
                                 gsmData.lac.c_str(), gsmData.cellId.c_str());
                }
            }
        }
    }
    
    // Obtener intensidad de señal GSM
    if (gsmData.isValid) {
        int16_t signalQuality = modem.getSignalQuality();
        if (signalQuality > 0 && signalQuality < 32) {
            // Convertir CSQ a dBm: dBm = -113 + (CSQ * 2)
            gsmData.signalStrength = -113 + (signalQuality * 2);
            Serial.printf("📶 Señal GSM: CSQ=%d, dBm=%d\n", 
                         signalQuality, gsmData.signalStrength);
        }
    }
    
    return gsmData.isValid;
}

// — Obtener ubicación vía API completa (WiFi + GSM + IP)
bool getWiFiLocation(LocationData &location) {
    location.isValid = false;
    location.method = WIFI_FALLBACK;
    
    Serial.println("🌐 Iniciando geolocalización híbrida (WiFi + GSM + IP)...");
    
    // PASO 1: Escanear redes WiFi cercanas
    WiFi.mode(WIFI_STA);
    int networkCount = WiFi.scanNetworks();
    
    // PASO 2: Obtener información GSM usando función auxiliar
    GSMData gsmData;
    bool gsmDataAvailable = getGSMCellInfo(gsmData);
    
    // PASO 3: Construir JSON para API completa
    String json = "{";
    json += "\"deviceId\":\"" + deviceId + "\"";
    
    // Incluir datos WiFi si están disponibles
    if (networkCount > 0) {
        json += ",\"wifiAccessPoints\":[";
        int validNetworks = 0;
        
        for (int i = 0; i < networkCount && validNetworks < 15; i++) {
            if (WiFi.RSSI(i) > -85) { // Filtro más permisivo para 2G
                if (validNetworks > 0) json += ",";
                json += "{";
                json += "\"macAddress\":\"" + WiFi.BSSIDstr(i) + "\"";
                
                // Escapar caracteres especiales en SSID
                String ssid = WiFi.SSID(i);
                ssid.replace("\"", "\\\""); // Escapar comillas
                ssid.replace("\\", "\\\\"); // Escapar backslashes
                json += ",\"ssid\":\"" + ssid + "\"";
                
                json += ",\"signalStrength\":" + String(WiFi.RSSI(i));
                json += "}";
                validNetworks++;
            }
        }
        json += "]";
        
        Serial.printf("📶 WiFi: %d redes válidas detectadas\n", validNetworks);
    }
    
    // Incluir datos GSM si están disponibles
    if (gsmDataAvailable && gsmData.mcc.length() > 0 && gsmData.mnc.length() > 0) {
        if (networkCount > 0) json += ","; // Solo agregar coma si hay WiFi antes
        
        json += "\"cellTowers\":[{";
        
        // Convertir strings a números enteros
        int cellIdNum = gsmData.cellId.toInt();
        int lacNum = gsmData.lac.toInt();
        int mccNum = gsmData.mcc.toInt();
        int mncNum = gsmData.mnc.toInt();
        
        // Validar rangos antes de incluir en JSON (específico para Ecuador)
        bool validGsmData = true;
        
        // Validar MCC específico para Ecuador
        if (mccNum != 740 && (mccNum < 200 || mccNum > 999)) {
            Serial.printf("⚠️ MCC inválido: %d (esperado 740 para Ecuador o 200-999 general)\n", mccNum);
            if (mccNum != 740) {
                Serial.println("💡 Nota: MCC 740 es específico de Ecuador");
            }
            validGsmData = false;
        }
        
        // Validar MNC específico para operadores ecuatorianos
        if (mccNum == 740) {
            if (mncNum != 0 && mncNum != 1 && mncNum != 2 && mncNum != 3) {
                Serial.printf("⚠️ MNC %d no reconocido para Ecuador\n", mncNum);
                Serial.println("💡 MNCs Ecuador: 0=Movistar, 1=Claro, 2=CNT, 3=Tuenti");
            }
        }
        
        if (mncNum < 0 || mncNum > 999) {
            Serial.printf("⚠️ MNC fuera de rango: %d (esperado 0-999)\n", mncNum);
            validGsmData = false;
        }
        
        if (cellIdNum <= 0 || cellIdNum > 65535) {
            Serial.printf("⚠️ CellID fuera de rango: %d (esperado 1-65535)\n", cellIdNum);
            validGsmData = false;
        }
        
        if (lacNum <= 0 || lacNum > 65535) {
            Serial.printf("⚠️ LAC fuera de rango: %d (esperado 1-65535)\n", lacNum);
            validGsmData = false;
        }
        
        if (validGsmData) {
            json += "\"cellId\":" + String(cellIdNum);
            json += ",\"locationAreaCode\":" + String(lacNum);
            json += ",\"mobileCountryCode\":" + String(mccNum);
            json += ",\"mobileNetworkCode\":" + String(mncNum);
            
            if (gsmData.signalStrength != 0) {
                json += ",\"signalStrength\":" + String(gsmData.signalStrength);
            }
            json += "}]";
            json += ",\"radioType\":\"gsm\"";
            
            // Mostrar información específica del operador ecuatoriano
            String operadorInfo = "Desconocido";
            if (mccNum == 740) {
                if (mncNum == 0) operadorInfo = "Movistar Ecuador";
                else if (mncNum == 1) operadorInfo = "Claro Ecuador";
                else if (mncNum == 2) operadorInfo = "CNT Mobile";
                else if (mncNum == 3) operadorInfo = "Tuenti Ecuador";
            }
            
            Serial.printf("📡 GSM válido Quito: %s (MCC=%d, MNC=%d, LAC=%d, Cell=%d)\n", 
                         operadorInfo.c_str(), mccNum, mncNum, lacNum, cellIdNum);
        } else {
            Serial.println("❌ Datos GSM inválidos, excluyendo torres celulares");
            gsmDataAvailable = false; // Marcar como no disponible
            json = json.substring(0, json.length() - 15); // Remover "\"cellTowers\":[{"
        }
    }
    
    // Incluir IP como fuente adicional
    if (networkCount > 0 || gsmDataAvailable) json += ",";
    json += "\"considerIp\":true";
    json += "}";
    
    // PASO 4: Verificar que tenemos al menos una fuente
    if (networkCount == 0 && !gsmDataAvailable) {
        Serial.println("❌ Sin datos WiFi ni GSM para geolocalización");
        return false;
    }
    
    // PASO 4.5: Validar JSON antes de enviar
    Serial.println("🔍 Validando JSON antes del envío...");
    Serial.println("📝 JSON construido: " + json);
    
    // Verificar que el JSON termina correctamente
    if (!json.endsWith("}")) {
        Serial.println("❌ JSON no termina correctamente, agregando cierre");
        json += "}";
    }
    
    // Verificar que el JSON es válido usando ArduinoJson
    DynamicJsonDocument testDoc(2048);
    DeserializationError parseError = deserializeJson(testDoc, json);
    
    if (parseError) {
        Serial.println("❌ JSON inválido construido:");
        Serial.println("Error: " + String(parseError.c_str()));
        Serial.println("JSON problemático: " + json);
        
        // Intentar crear un JSON mínimo solo con IP si todo falla
        if (networkCount == 0 && !gsmDataAvailable) {
            Serial.println("🔧 Creando JSON mínimo solo con IP...");
            json = "{\"deviceId\":\"" + deviceId + "\",\"considerIp\":true}";
            
            // Validar JSON mínimo
            DynamicJsonDocument minDoc(512);
            DeserializationError minError = deserializeJson(minDoc, json);
            if (minError) {
                Serial.println("❌ Incluso JSON mínimo falló");
                return false;
            }
            Serial.println("✅ Usando JSON mínimo con IP solamente");
        } else {
            return false;
        }
    }
    
    // Verificar campos requeridos
    if (!testDoc["deviceId"] || testDoc["deviceId"].as<String>().length() == 0) {
        Serial.println("❌ deviceId faltante o vacío");
        return false;
    }
    
    // Verificar que al menos una fuente esté presente
    bool hasWifi = testDoc["wifiAccessPoints"] && testDoc["wifiAccessPoints"].size() > 0;
    bool hasGsm = testDoc["cellTowers"] && testDoc["cellTowers"].size() > 0;
    bool hasIp = testDoc["considerIp"];
    
    if (!hasWifi && !hasGsm && !hasIp) {
        Serial.println("❌ No hay fuentes de geolocalización válidas");
        return false;
    }
    
    Serial.printf("✅ JSON válido | Fuentes: WiFi:%s GSM:%s IP:%s\n", 
                 hasWifi ? "Sí" : "No", hasGsm ? "Sí" : "No", hasIp ? "Sí" : "No");
    
    // PASO 5: Enviar a la API de geolocalización con fallback de conectividad
    Serial.println("🔍 Enviando datos a API de geolocalización...");
    Serial.println("📝 JSON: " + json);
    
    bool requestSuccess = false;
    String response = "";
    int httpCode = 0;
    unsigned long responseTime = 0;
    
    // MÉTODO 1: Intentar primero por WiFi
    Serial.println("🌐 Método 1: Intentando conexión WiFi...");
    
    // Activar modo WiFi usando credenciales de test.h
    WiFi.mode(WIFI_STA);
    #ifdef TEST_WIFI
    WiFi.begin(ssid, password);
    #else
    // Si no hay TEST_WIFI definido, saltar directamente a 2G
    Serial.println("⚠️ TEST_WIFI no definido, saltando a 2G...");
    #endif
    
    #ifdef TEST_WIFI
    int wifiAttempts = 0;
    while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20) {
        delay(500);
        Serial.print(".");
        wifiAttempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n✅ WiFi conectado: " + WiFi.localIP().toString());
        
        HTTPClient http;
        String fullUrl = apiBase + "/api/location/wifi";
        http.begin(fullUrl);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("User-Agent", "OniChip-ESP32-WiFi/1.0");
        http.setTimeout(15000); // 15 segundos para WiFi
        
        unsigned long startTime = millis();
        httpCode = http.POST(json);
        responseTime = millis() - startTime;
        
        Serial.printf("📶 WiFi - Tiempo: %lums, HTTP: %d\n", responseTime, httpCode);
        
        if (httpCode == 200) {
            response = http.getString();
            requestSuccess = true;
            Serial.println("✅ Geolocalización exitosa por WiFi");
        } else {
            Serial.printf("⚠️ WiFi falló (HTTP %d), intentando 2G...\n", httpCode);
        }
        
        http.end();
        
        // Desconectar WiFi después del intento
        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
        delay(1000);
    } else {
        Serial.println("\n⚠️ WiFi no disponible, intentando 2G...");
        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
        delay(1000);
    }
    #endif
    
    // MÉTODO 2: Si WiFi falló, intentar por datos móviles 2G
    if (!requestSuccess) {
        Serial.println("📡 Método 2: Intentando conexión datos móviles 2G...");
        
        // Verificar conexión GPRS
        if (!modem.isGprsConnected()) {
            Serial.println("🔄 Conectando GPRS...");
            if (!modem.gprsConnect(GPRS_APN, GPRS_USER, GPRS_PASS)) {
                Serial.println("❌ Error conectando GPRS");
                return false;
            }
        }
        
        Serial.println("✅ GPRS conectado, enviando datos...");
        
        HTTPClient http;
        String fullUrl = apiBase + "/api/location/wifi";
        http.begin(fullUrl);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("User-Agent", "OniChip-ESP32-2G/1.0");
        http.setTimeout(25000); // 25 segundos para 2G (más lento)
        
        unsigned long startTime = millis();
        httpCode = http.POST(json);
        responseTime = millis() - startTime;
        
        Serial.printf("📡 2G - Tiempo: %lums, HTTP: %d\n", responseTime, httpCode);
        
        if (httpCode == 200) {
            response = http.getString();
            requestSuccess = true;
            Serial.println("✅ Geolocalización exitosa por datos móviles 2G");
        } else {
            Serial.printf("❌ Ambos métodos fallaron. Último error HTTP: %d\n", httpCode);
        }
        
        http.end();
    }
    
    // PASO 6: Procesar respuesta si fue exitosa
    if (requestSuccess && response.length() > 0) {
        Serial.println("📦 Respuesta: " + response);
        
        // Parse JSON response
        DynamicJsonDocument doc(1024);
        DeserializationError error = deserializeJson(doc, response);
        
        if (!error && doc["status"] == "OK") {
            location.latitude = doc["location"]["lat"];
            location.longitude = doc["location"]["lng"];
            location.accuracy = doc["accuracy"] | 1000;
            location.speed = 0.0; // API no proporciona velocidad
            location.satellites = 0;
            location.isValid = true;
            location.method = WIFI_FALLBACK;
            
            // Mostrar información de fuentes utilizadas
            if (doc["sources"]) {
                int wifiUsed = doc["sources"]["wifi"] | 0;
                int gsmUsed = doc["sources"]["gsm"] | 0;
                bool ipUsed = doc["sources"]["ip"] | false;
                
                Serial.printf("✅ Ubicación obtenida: %.6f, %.6f\n", 
                             location.latitude, location.longitude);
                Serial.printf("📊 Precisión: ±%.0fm | Fuentes: WiFi:%d GSM:%d IP:%s\n", 
                             location.accuracy, wifiUsed, gsmUsed, ipUsed ? "Sí" : "No");
                
                if (doc["quality"]) {
                    Serial.println("🎯 Calidad: " + String(doc["quality"].as<String>()));
                }
            }
            
            return true;
        } else {
            Serial.println("❌ Error parseando respuesta JSON");
            if (error) {
                Serial.println("Error JSON: " + String(error.c_str()));
            }
        }
    } else {
        // Mostrar errores específicos según el código HTTP
        if (httpCode == 400) {
            Serial.println("❌ Error 400 - El servidor rechazó los datos");
            Serial.println("💡 Posibles causas:");
            Serial.println("   - JSON malformado");
            Serial.println("   - Campos requeridos faltantes");
            Serial.println("   - Valores fuera de rango");
            Serial.println("   - API Key de Google inválida");
            
            // Mostrar respuesta del servidor si está disponible
            if (response.length() > 0) {
                Serial.println("📋 Respuesta del servidor:");
                Serial.println(response);
            }
        } else if (httpCode == 403) {
            Serial.println("❌ Error 403 - Problema con API Key de Google");
            Serial.println("💡 Verificar configuración del backend");
        } else if (httpCode == 404) {
            Serial.println("❌ Error 404 - Endpoint no encontrado");
            Serial.println("💡 Verificar URL: " + apiBase + "/api/location/wifi");
        } else if (httpCode == 500) {
            Serial.println("❌ Error 500 - Error interno del servidor");
            if (response.length() > 0) {
                Serial.println("📋 Respuesta del servidor:");
                Serial.println(response);
            }
        } else if (httpCode > 0) {
            Serial.printf("❌ Error HTTP %d\n", httpCode);
            if (response.length() > 0) {
                Serial.println("📋 Respuesta del servidor:");
                Serial.println(response);
            }
        } else {
            Serial.println("❌ Error de conectividad - Sin respuesta del servidor");
        }
    }
    
    Serial.println("❌ Error en geolocalización híbrida - Todos los métodos fallaron");
    return false;
}

// — Método híbrido: GPS primero, WiFi como fallback
bool readLocationHybrid(LocationData &location) {
    // Intentar GPS primero
    if (readGPS(location)) {
        return true;
    }
    
    // Si GPS falla, usar WiFi
    Serial.println("🔄 GPS falló, intentando WiFi...");
    if (getWiFiLocation(location)) {
        return true;
    }
    
    Serial.println("❌ Ambos métodos de localización fallaron");
    return false;
}

// — Función principal de lectura de datos
void readAllData(LocationData &location, float &batV, bool &charging) {
    // Leer ubicación con método híbrido
    bool locationOk = readLocationHybrid(location);
    
    // Leer estado de batería
    batV = readBatteryLevel();
    charging = readChargingStatus();
    
    if (locationOk) {
        String method = (location.method == GPS_ONLY) ? "GPS" : "WiFi";
        Serial.printf("📍 %s Loc: %.6f, %.6f | Batería: %.2f V | Carga: %s\n",
                      method.c_str(), location.latitude, location.longitude, batV,
                      charging ? "Sí" : "No");
    } else {
        Serial.printf("❌ Sin ubicación | Batería: %.2f V | Carga: %s\n",
                      batV, charging ? "Sí" : "No");
    }
}

// — Construir JSON para enviar al servidor
String buildLocationJson(LocationData &location, float batV, bool charging) {
    String json = "{";
    json += "\"deviceId\":\"" + deviceId + "\",";
    json += "\"timestamp\":" + String(location.timestamp) + ",";
    
    if (location.isValid) {
        json += "\"location\":{";
        json += "\"latitude\":" + String(location.latitude, 6) + ",";
        json += "\"longitude\":" + String(location.longitude, 6) + ",";
        json += "\"accuracy\":" + String(location.accuracy, 2) + ",";
        json += "\"speed\":" + String(location.speed, 2) + ",";
        json += "\"satellites\":" + String(location.satellites) + ",";
        json += "\"method\":\"" + String(location.method == GPS_ONLY ? "GPS" : "WiFi") + "\"";
        json += "},";
    }
    
    json += "\"battery\":{";
    json += "\"level\":" + String(batV, 2) + ",";
    json += "\"charging\":" + String(charging ? "true" : "false");
    json += "}";
    json += "}";
    
    return json;
}

// — FUNCIONES ORIGINALES MANTENIDAS PARA COMPATIBILIDAD
bool readGps(float &lat, float &lon, float &speedKmh) {
    LocationData location;
    bool success = readGPS(location);
    if (success) {
        lat = location.latitude;
        lon = location.longitude;
        speedKmh = location.speed;
    }
    return success;
}

void readData(float &lat, float &lon, float &speedKmh,
              int &vitals, float &batV, bool &charging) {
    LocationData location;
    readAllData(location, batV, charging);
    
    if (location.isValid) {
        lat = location.latitude;
        lon = location.longitude;
        speedKmh = location.speed;
    } else {
        lat = 0.0;
        lon = 0.0;
        speedKmh = 0.0;
    }
    
    vitals = 0; // Ya no usamos signos vitales
}

// — Procesar comandos de diagnóstico desde Serial Monitor
void procesarComandosDiagnostico() {
    if (Serial.available() > 0) {
        String comando = Serial.readStringUntil('\n');
        comando.trim();
        comando.toLowerCase();
        
        Serial.println("\n🔧 Comando recibido: " + comando);
        
        if (comando == "help" || comando == "ayuda") {
            Serial.println("\n📋 === COMANDOS DE DIAGNÓSTICO DISPONIBLES ===");
            Serial.println("help          - Mostrar esta ayuda");
            Serial.println("status        - Estado actual de conexiones");
            Serial.println("connect       - Ejecutar proceso de conexión manual");
            Serial.println("disconnect    - Desconectar todas las redes");
            Serial.println("check         - Verificar conexión actual con backend");
            Serial.println("2g            - Diagnóstico completo 2G/móvil");
            Serial.println("datos         - Forzar uso SOLO datos móviles");
            Serial.println("backend       - Test conectividad backend");
            Serial.println("reconectar    - Diagnóstico de reconexión");
            Serial.println("gps           - Diagnóstico GPS");
            Serial.println("wifi          - Estado WiFi");
            Serial.println("modem         - Info detallada del módem");
            Serial.println("signal        - Calidad de señal móvil");
            Serial.println("reset         - Resetear módem SIM800");
            Serial.println("memoria       - Estado de memoria ESP32");
            Serial.println("📱 NUEVOS: connect, disconnect, check");
            Serial.println("📋 === FIN AYUDA ===\n");
            
        } else if (comando == "status" || comando == "estado") {
            mostrarEstadoConexion();
            
        } else if (comando == "connect" || comando == "conectar") {
            Serial.println("\n🔗 === EJECUTANDO CONEXIÓN MANUAL ===");
            disconnect(); // Primero desconectar todo
            delay(1000);
            ConnType result = connect();
            if (result == CONN_NONE) {
                Serial.println("❌ Conexión fallida");
            } else {
                Serial.printf("✅ Conectado vía %s\n", result == CONN_WIFI ? "WiFi" : "2G");
            }
            
        } else if (comando == "disconnect" || comando == "desconectar") {
            Serial.println("\n🔌 === DESCONECTANDO MANUALMENTE ===");
            disconnect();
            
        } else if (comando == "check" || comando == "verificar") {
            Serial.println("\n🔍 === VERIFICANDO CONEXIÓN BACKEND ===");
            bool connected = checkConnection();
            Serial.printf("Estado: %s\n", connected ? "✅ Conectado" : "❌ Desconectado");
            Serial.printf("Conexión actual: %s\n", 
                         currentConnection == CONN_WIFI ? "WiFi" : 
                         currentConnection == CONN_2G ? "2G" : "Ninguna");
            
        } else if (comando == "2g" || comando == "movil") {
            diagnosticoConexion2G();
            
        } else if (comando == "backend" || comando == "servidor") {
            testConectividadBackend();
            
        } else if (comando == "reconectar" || comando == "reconexion") {
            diagnosticoReconexion();
            
        } else if (comando == "gps") {
            diagnosticoGPS();
            
        } else if (comando == "wifi") {
            Serial.println("\n📶 === ESTADO WIFI ===");
            if (WiFi.getMode() == WIFI_OFF) {
                Serial.println("⚪ WiFi deshabilitado");
            } else {
                Serial.printf("📋 Estado: %d\n", WiFi.status());
                if (WiFi.status() == WL_CONNECTED) {
                    Serial.println("✅ WiFi conectado");
                    Serial.println("📱 IP: " + WiFi.localIP().toString());
                    Serial.println("📶 RSSI: " + String(WiFi.RSSI()) + " dBm");
                    Serial.println("🌐 SSID: " + WiFi.SSID());
                    Serial.println("🔐 Canal: " + String(WiFi.channel()));
                } else {
                    Serial.println("❌ WiFi no conectado");
                }
            }
            Serial.println("📶 === FIN ESTADO WIFI ===\n");
            
        } else if (comando == "datos" || comando == "2gonly") {
            Serial.println("\n📡 === FORZANDO SOLO DATOS MÓVILES 2G ===");
            
            // Desconectar todo primero
            disconnect();
            delay(1000);
            
            // Forzar conexión solo 2G (sin intentar WiFi)
            Serial.println("📡 Conectando directamente datos móviles 2G...");
            
            if (!modem.isNetworkConnected()) {
                Serial.println("❌ Sin señal de red móvil");
                return;
            }
            
            if (!modem.isGprsConnected()) {
                if (!modem.gprsConnect(GPRS_APN, GPRS_USER, GPRS_PASS)) {
                    Serial.println("❌ Fallo GPRS");
                    return;
                }
            }
            
            currentConnection = CONN_2G;
            isConnectedToInternet = true;
            Serial.println("✅ Conectado SOLO vía datos móviles 2G");
            Serial.println("💡 WiFi deshabilitado, solo 2G activo");
            
        } else if (comando == "modem") {
            Serial.println("\n📱 === INFO DETALLADA MÓDEM ===");
            
            if (modem.testAT()) {
                Serial.println("✅ Módem respondiendo");
                
                // Información del módem
                SerialAT.println("ATI");
                delay(1000);
                Serial.print("📱 Modelo: ");
                while (SerialAT.available()) {
                    Serial.print(SerialAT.readString());
                }
                
                // Versión firmware
                SerialAT.println("AT+GMR");
                delay(1000);
                Serial.print("🔧 Firmware: ");
                while (SerialAT.available()) {
                    Serial.print(SerialAT.readString());
                }
                
                // IMEI
                SerialAT.println("AT+GSN");
                delay(1000);
                Serial.print("🆔 IMEI: ");
                while (SerialAT.available()) {
                    Serial.print(SerialAT.readString());
                }
                
                // Estado de registro
                SerialAT.println("AT+CREG?");
                delay(1000);
                Serial.print("📡 Registro: ");
                while (SerialAT.available()) {
                    Serial.print(SerialAT.readString());
                }
                
            } else {
                Serial.println("❌ Módem no responde");
            }
            Serial.println("📱 === FIN INFO MÓDEM ===\n");
            
        } else if (comando == "signal" || comando == "señal") {
            Serial.println("\n📶 === CALIDAD DE SEÑAL ===");
            
            int16_t signal = modem.getSignalQuality();
            Serial.printf("📶 RSSI: %d/31 ", signal);
            
            if (signal >= 20) Serial.println("(Excelente)");
            else if (signal >= 15) Serial.println("(Buena)"); 
            else if (signal >= 10) Serial.println("(Regular)");
            else if (signal >= 5) Serial.println("(Pobre)");
            else Serial.println("(Sin señal)");
            
            // Información adicional de red
            String operator_name = modem.getOperator();
            Serial.println("📡 Operador: " + operator_name);
            
            Serial.println("📶 === FIN CALIDAD SEÑAL ===\n");
            
        } else if (comando == "reset") {
            Serial.println("\n🔄 === RESET MÓDEM SIM800 ===");
            Serial.println("🔧 Reiniciando módem...");
            
            modem.restart();
            delay(5000);
            
            if (modem.testAT()) {
                Serial.println("✅ Módem reiniciado correctamente");
            } else {
                Serial.println("❌ Error en reinicio del módem");
            }
            Serial.println("🔄 === FIN RESET MÓDEM ===\n");
            
        } else if (comando == "memoria" || comando == "ram") {
            Serial.println("\n💾 === ESTADO MEMORIA ESP32 ===");
            Serial.printf("🔋 Memoria libre: %d bytes\n", ESP.getFreeHeap());
            Serial.printf("📊 Memoria total: %d bytes\n", ESP.getHeapSize());
            Serial.printf("📈 Memoria mínima libre: %d bytes\n", ESP.getMinFreeHeap());
            Serial.printf("⏱️ Uptime: %lu ms\n", millis());
            Serial.printf("🔧 Chip Rev: %d\n", ESP.getChipRevision());
            Serial.printf("⚡ Frecuencia CPU: %d MHz\n", ESP.getCpuFreqMHz());
            Serial.println("💾 === FIN ESTADO MEMORIA ===\n");
            
        } else if (comando == "datos" || comando == "movil" || comando == "force2g") {
            Serial.println("\n📱 === FORZAR USO DATOS MÓVILES ===");
            
            // Desactivar WiFi completamente
            Serial.println("🔧 Desactivando WiFi...");
            WiFi.disconnect(true);
            WiFi.mode(WIFI_OFF);
            delay(2000);
            Serial.println("✅ WiFi desactivado");
            
            // Verificar y establecer conexión 2G
            Serial.println("📱 Verificando conexión datos móviles...");
            ConnStatus status = checkConnectionLegacy();
            
            switch (status) {
                case CONN_OK: {
                    Serial.println("✅ Conexión datos móviles OK");
                    
                    // Test rápido de conectividad
                    Serial.println("🌐 Probando conectividad...");
                    HTTPClient http;
                    http.begin("http://httpbin.org/ip");
                    http.setTimeout(10000);
                    
                    int httpCode = http.GET();
                    if (httpCode == 200) {
                        String response = http.getString();
                        Serial.println("✅ Internet vía datos móviles OK");
                        Serial.println("📱 Respuesta: " + response);
                    } else {
                        Serial.println("❌ Sin acceso a internet vía datos móviles");
                        Serial.println("🔧 Código error: " + String(httpCode));
                    }
                    http.end();
                    break;
                }
                    
                case NO_NETWORK:
                    Serial.println("❌ Sin red móvil - Ejecutando reconexión...");
                    reconnect();
                    break;
                    
                case GPRS_FAIL:
                    Serial.println("❌ Fallo GPRS - Ejecutando reconexión...");
                    reconnect();
                    break;
            }
            Serial.println("📱 === FIN FORZAR DATOS MÓVILES ===\n");
            
        } else if (comando != "") {
            Serial.println("❌ Comando no reconocido: " + comando);
            Serial.println("💡 Escribe 'help' para ver comandos disponibles");
        }
    }
}

// — Diagnóstico GPS NEO-6M
void diagnosticoGPS() {
    Serial.println("\n🔧 === DIAGNÓSTICO GPS NEO-6M ===");
    
    // Test 1: Verificar comunicación serie
    Serial.println("📡 Test 1: Comunicación serie GPS...");
    ss.flush();
    delay(100);
    
    unsigned long start = millis();
    int caracteres = 0;
    while (millis() - start < 3000) { // 3 segundos
        if (ss.available()) {
            char c = ss.read();
            if (c == '$') Serial.print("\n");
            Serial.print(c);
            caracteres++;
        }
    }
    
    if (caracteres > 0) {
        Serial.printf("\n✅ GPS respondiendo - %d caracteres recibidos\n", caracteres);
    } else {
        Serial.println("\n❌ GPS no responde - Verificar:");
        Serial.println("   • Conexiones VCC(3.3V), GND, TX(14), RX(12)");
        Serial.println("   • Antena GPS conectada");
        Serial.println("   • Módulo alimentado correctamente");
        return;
    }
    
    // Test 2: Estado de satélites
    Serial.println("\n📡 Test 2: Estado satelital...");
    
    uint8_t visibleSats = 0;
    bool gotFix = false;
    unsigned long startSatTest = millis();
    int maxSatellites = 0;
    float hdopValue = 0.0;
    
    // Leer datos GPS por 10 segundos para obtener estado satelital
    while (millis() - startSatTest < 10000) {
        while (ss.available() > 0) {
            char c = ss.read();
            
            if (gps.encode(c)) {
                // Actualizar información de satélites
                if (gps.satellites.isValid()) {
                    visibleSats = gps.satellites.value();
                    if (visibleSats > maxSatellites) {
                        maxSatellites = visibleSats;
                    }
                }
                
                // Actualizar HDOP si está disponible
                if (gps.hdop.isValid()) {
                    hdopValue = gps.hdop.hdop();
                }
                
                // Verificar si tenemos fix GPS
                if (gps.location.isValid() && !gotFix) {
                    gotFix = true;
                    Serial.printf("🛰️ Satélites visibles: %d\n", visibleSats);
                    Serial.printf("📍 Ubicación: %.6f, %.6f\n",
                                  gps.location.lat(), gps.location.lng());
                    
                    if (gps.hdop.isValid()) {
                        Serial.printf("📊 HDOP: %.2f ", hdopValue);
                        if (hdopValue < 2.0) {
                            Serial.println("(Excelente)");
                        } else if (hdopValue < 5.0) {
                            Serial.println("(Buena)");
                        } else {
                            Serial.println("(Regular)");
                        }
                    }
                    
                    Serial.println("✅ GPS con FIX satelital!");
                }
            }
        }
        delay(10);  // Pequeña pausa para no saturar el CPU
    }
    
    // Mostrar resumen del estado satelital
    if (maxSatellites > 0) {
        Serial.printf("📊 Máximo satélites detectados: %d\n", maxSatellites);
        
        if (maxSatellites >= 4) {
            Serial.println("✅ Suficientes satélites para fix 3D");
        } else if (maxSatellites >= 3) {
            Serial.println("⚠️ Satélites suficientes solo para fix 2D");
        } else {
            Serial.println("❌ Insuficientes satélites para fix GPS");
        }
        
        if (hdopValue > 0) {
            Serial.printf("📊 Última precisión HDOP: %.2f\n", hdopValue);
        }
        
        if (!gotFix) {
            Serial.println("⚠️ Satélites detectados pero sin fix de posición");
            Serial.println("💡 Esperar más tiempo o mejorar vista del cielo");
        }
        
    } else {
        Serial.println("❌ No se detectaron satélites");
        Serial.println("💡 Verificar:");
        Serial.println("   • Antena GPS conectada correctamente");
        Serial.println("   • Ubicación con vista despejada del cielo");
        Serial.println("   • Módulo GPS alimentado");
        Serial.println("   • Tiempo suficiente para cold start (puede tomar varios minutos)");
    }
    
    // Test 3: Estadísticas GPS
    Serial.println("\n📊 Estadísticas GPS:");
    Serial.printf("   • Caracteres procesados: %d\n", gps.charsProcessed());
    Serial.printf("   • Sentencias válidas: %d\n", gps.sentencesWithFix());
    Serial.printf("   • Errores checksum: %d\n", gps.failedChecksum());
    
    if (gps.charsProcessed() < 100) {
        Serial.println("⚠️ Pocos datos GPS - Verificar antena y ubicación");
    }
    
    if (gps.satellites.isValid()) {
        int sats = gps.satellites.value();
        if (sats < 4) {
            Serial.printf("⚠️ Insuficientes satélites (%d/4 mín) - Colocar al aire libre\n", sats);
        }
    } else {
        Serial.println("❌ No se detectan satélites - Verificar antena GPS");
    }
    
    Serial.println("🔧 === FIN DIAGNÓSTICO ===\n");
}

// 🔧 VERIFICACIÓN ESPECÍFICA DE CALIBRACIÓN GPS
void verificarCalibracionGPS() {
    Serial.println("\n🎯 === VERIFICACIÓN CALIBRACIÓN GPS ===");
    
    unsigned long startTime = millis();
    int fixCount = 0;
    float lastLat = 0, lastLon = 0;
    float totalHDOP = 0;
    int hdopReadings = 0;
    int maxSatellites = 0;
    bool calibracionOK = false;
    
    Serial.println("🔄 Monitoreando GPS por 30 segundos...");
    Serial.println("Indicadores de buena calibración:");
    Serial.println("  ✅ 4+ satélites");
    Serial.println("  ✅ HDOP < 2.0");
    Serial.println("  ✅ Fix estable");
    Serial.println("  ✅ Coordenadas consistentes\n");
    
    while (millis() - startTime < 30000) { // 30 segundos
        while (ss.available() > 0) {
            if (gps.encode(ss.read())) {
                // Verificar satélites
                if (gps.satellites.isValid()) {
                    int sats = gps.satellites.value();
                    if (sats > maxSatellites) maxSatellites = sats;
                    
                    Serial.printf("🛰️ Satélites: %d ", sats);
                    if (sats >= 4) {
                        Serial.print("✅");
                    } else {
                        Serial.print("❌");
                    }
                }
                
                // Verificar HDOP (precisión)
                if (gps.hdop.isValid()) {
                    float hdop = gps.hdop.hdop();
                    totalHDOP += hdop;
                    hdopReadings++;
                    
                    Serial.printf(" | HDOP: %.2f ", hdop);
                    if (hdop < 2.0) {
                        Serial.print("✅");
                    } else if (hdop < 5.0) {
                        Serial.print("⚠️");
                    } else {
                        Serial.print("❌");
                    }
                }
                
                // Verificar ubicación
                if (gps.location.isValid()) {
                    float lat = gps.location.lat();
                    float lon = gps.location.lng();
                    fixCount++;
                    
                    Serial.printf(" | Fix: %.6f,%.6f ", lat, lon);
                    
                    // Verificar estabilidad de coordenadas
                    if (lastLat != 0 && lastLon != 0) {
                        float distance = TinyGPSPlus::distanceBetween(lastLat, lastLon, lat, lon);
                        if (distance < 10.0) { // Menos de 10m de variación
                            Serial.print("✅ Estable");
                        } else if (distance < 50.0) {
                            Serial.print("⚠️ Variable");
                        } else {
                            Serial.print("❌ Inestable");
                        }
                    }
                    
                    lastLat = lat;
                    lastLon = lon;
                } else {
                    Serial.print(" | Sin Fix ❌");
                }
                
                Serial.println();
            }
        }
        
        // Mostrar progreso cada 5 segundos
        if ((millis() - startTime) % 5000 < 100) {
            int elapsed = (millis() - startTime) / 1000;
            Serial.printf("⏱️ Tiempo transcurrido: %ds/30s\n", elapsed);
        }
        
        delay(100);
    }
    
    // Análisis final de calibración
    Serial.println("\n📊 === ANÁLISIS DE CALIBRACIÓN ===");
    Serial.printf("🛰️ Máximo satélites detectados: %d\n", maxSatellites);
    Serial.printf("📍 Fixes GPS obtenidos: %d\n", fixCount);
    
    if (hdopReadings > 0) {
        float avgHDOP = totalHDOP / hdopReadings;
        Serial.printf("📊 HDOP promedio: %.2f\n", avgHDOP);
        
        // Evaluación de calibración
        bool satellitesOK = (maxSatellites >= 4);
        bool hdopOK = (avgHDOP < 2.5);
        bool fixesOK = (fixCount > 5);
        
        calibracionOK = satellitesOK && hdopOK && fixesOK;
        
        Serial.println("\n🎯 ESTADO DE CALIBRACIÓN:");
        Serial.printf("   Satélites (4+): %s (%d)\n", 
                     satellitesOK ? "✅ OK" : "❌ FALLO", maxSatellites);
        Serial.printf("   Precisión (<2.5): %s (%.2f)\n", 
                     hdopOK ? "✅ OK" : "❌ FALLO", avgHDOP);
        Serial.printf("   Fixes estables: %s (%d)\n", 
                     fixesOK ? "✅ OK" : "❌ FALLO", fixCount);
        
        if (calibracionOK) {
            Serial.println("\n🎉 ✅ GPS CORRECTAMENTE CALIBRADO");
            Serial.println("   El módulo está listo para tracking");
        } else {
            Serial.println("\n⚠️ ❌ GPS NECESITA RECALIBRACIÓN");
            Serial.println("   Recomendaciones:");
            if (!satellitesOK) Serial.println("   • Colocar al aire libre con cielo despejado");
            if (!hdopOK) Serial.println("   • Esperar más tiempo para mejor precisión");
            if (!fixesOK) Serial.println("   • Verificar antena GPS y conexiones");
        }
    } else {
        Serial.println("❌ No se pudieron obtener datos de precisión");
        Serial.println("   Verificar conexiones y antena GPS");
    }
    
    Serial.println("🎯 === FIN VERIFICACIÓN ===\n");
}

// — Test inicial de hardware para detectar problemas de arranque
bool testHardware() {
    Serial.println("\n🔧 === TEST INICIAL DE HARDWARE ===");
    
    // Test 1: Verificar memoria y sistema
    Serial.printf("💾 Memoria libre: %d bytes\n", ESP.getFreeHeap());
    Serial.printf("🔄 Frecuencia CPU: %d MHz\n", ESP.getCpuFreqMHz());
    Serial.printf("⚡ Voltaje de entrada: %.2f V\n", readBatteryLevel());
    
    if (ESP.getFreeHeap() < 50000) {
        Serial.println("❌ Memoria insuficiente");
        return false;
    }
    
    // Test 2: Verificar pines críticos para T-Call v1.4
    Serial.println("📌 Verificando pines T-Call v1.4...");
    
    // Test de pines GPS específicos para T-Call v1.4
    pinMode(GPS_TX_PIN, INPUT);   // Pin 33 como entrada (recibe del GPS)
    pinMode(GPS_RX_PIN, OUTPUT);  // Pin 32 como salida (envía al GPS)
    digitalWrite(GPS_RX_PIN, HIGH);
    delay(100);
    
    Serial.printf("   GPS TX Pin %d (entrada): Disponible\n", GPS_TX_PIN);
    Serial.printf("   GPS RX Pin %d (salida): Disponible\n", GPS_RX_PIN);
    
    // Verificar que los pines no estén en conflicto con SIM800
    if (GPS_TX_PIN == MODEM_TX_PIN || GPS_TX_PIN == MODEM_RX_PIN ||
        GPS_RX_PIN == MODEM_TX_PIN || GPS_RX_PIN == MODEM_RX_PIN) {
        Serial.println("   ❌ ERROR: Conflicto GPS-SIM800");
        return false;
    } else {
        Serial.println("   ✅ Sin conflictos GPS-SIM800");
    }
    
    // Test toggle del pin RX GPS
    digitalWrite(GPS_RX_PIN, LOW);
    delay(50);
    digitalWrite(GPS_RX_PIN, HIGH);
    Serial.printf("   GPS RX Pin %d: Test toggle OK\n", GPS_RX_PIN);
    
    // Test 3: Verificar I2C (IP5306)
    Wire.begin(I2C_SDA_POWER, I2C_SCL_POWER);
    Wire.beginTransmission(IP5306_ADDR);
    uint8_t i2cError = Wire.endTransmission();
    
    if (i2cError == 0) {
        Serial.println("✅ I2C/IP5306 OK");
    } else {
        Serial.printf("⚠️ I2C Error: %d\n", i2cError);
    }
    
    int i2cResult = Wire.endTransmission();
    Serial.printf("   I2C (IP5306): %s\n", i2cResult == 0 ? "OK" : "ERROR");
    
    // Test 4: Verificar pines críticos del módem
    pinMode(MODEM_PWKEY_PIN, OUTPUT);
    pinMode(MODEM_RST_PIN, OUTPUT);
    pinMode(MODEM_POWERON_PIN, OUTPUT);
    Serial.println("✅ Pines de control módem configurados");
    
    // Test 5: Test LED
    Serial.println("💡 Test LED (3 parpadeos)...");
    for(int i = 0; i < 3; i++) {
        digitalWrite(STATUS_LED_PIN, HIGH);
        delay(200);
        digitalWrite(STATUS_LED_PIN, LOW);
        delay(200);
    }
    
    Serial.println("✅ Test de hardware completado");
    Serial.println("🔧 === FIN TEST HARDWARE ===\n");
    
    return true;
}

// — Diagnóstico completo y reparación de conexión 2G/móvil para Movistar Ecuador
bool diagnosticoConexion2G() {
    Serial.println("\n📱 === DIAGNÓSTICO Y REPARACIÓN CONEXIÓN 2G MOVISTAR ECUADOR ===");
    Serial.println("🎯 Objetivo: Establecer conexión de datos móviles funcional");
    
    // Paso 0: Apagar WiFi para forzar uso de datos móviles
    Serial.println("📱 Deshabilitando WiFi para usar solo datos móviles...");
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    delay(2000);
    Serial.println("✅ WiFi deshabilitado - Solo usará datos móviles");
    
    // Paso 1: Reset completo del módem SIM800
    Serial.println("🔧 Reset completo del módem SIM800...");
    
    // Secuencia de reset mejorada para T-Call v1.4
    digitalWrite(MODEM_POWERON_PIN, LOW);  // Apagar módem
    delay(1000);
    digitalWrite(MODEM_RST_PIN, LOW);      // Reset activo
    delay(100);
    digitalWrite(MODEM_RST_PIN, HIGH);     // Liberar reset
    delay(1000);
    digitalWrite(MODEM_POWERON_PIN, HIGH); // Encender módem
    delay(5000); // Tiempo extendido para arranque completo
    
    // Test básico de comunicación AT
    SerialAT.println("AT");
    String response = "";
    unsigned long timeout = millis() + 5000;
    
    while (millis() < timeout) {
        if (SerialAT.available()) {
            response += SerialAT.readString();
            if (response.indexOf("OK") >= 0) break;
        }
        delay(100);
    }
    
    if (response.indexOf("OK") >= 0) {
        Serial.println("✅ Comunicación AT OK");
    } else {
        Serial.println("❌ Módem no responde a comandos AT");
        Serial.println("💡 Verificar:");
        Serial.println("   • Conexiones UART (TX:27, RX:26)");
        Serial.println("   • Alimentación del SIM800");
        Serial.println("   • Reset del módem");
        return false;
    }
    
    // Paso 2: Verificar información del módem
    Serial.println("\n📋 Información del módem:");
    
    // Modelo del módem
    SerialAT.println("ATI");
    delay(1000);
    while (SerialAT.available()) {
        Serial.print("📱 ");
        Serial.println(SerialAT.readString());
    }
    
    // Paso 3: Estado de la SIM
    Serial.println("🔐 Verificando SIM...");
    SerialAT.println("AT+CPIN?");
    delay(1000);
    response = "";
    while (SerialAT.available()) {
        response += SerialAT.readString();
    }
    
    if (response.indexOf("READY") >= 0) {
        Serial.println("✅ SIM lista y desbloqueada");
    } else if (response.indexOf("SIM PIN") >= 0) {
        Serial.println("⚠️ SIM requiere PIN");
        if (strlen(SIM_PIN) > 0) {
            SerialAT.println("AT+CPIN=" + String(SIM_PIN));
            delay(2000);
            Serial.println("🔓 Intentando desbloquear SIM...");
        } else {
            Serial.println("❌ PIN requerido pero no configurado en config.h");
            return false;
        }
    } else {
        Serial.println("❌ Error con la SIM:");
        Serial.println(response);
        return false;
    }
    
    // Paso 4: Información del operador
    Serial.println("\n📡 Información del operador:");
    SerialAT.println("AT+COPS?");
    delay(2000);
    while (SerialAT.available()) {
        String operatorInfo = SerialAT.readString();
        Serial.print("📡 ");
        Serial.println(operatorInfo);
        
        // Verificar si es Movistar Ecuador
        if (operatorInfo.indexOf("Movistar") >= 0 || operatorInfo.indexOf("73402") >= 0) {
            Serial.println("✅ Conectado a Movistar Ecuador");
        }
    }
    
    // Paso 5: Calidad de señal
    Serial.println("\n📶 Calidad de señal:");
    SerialAT.println("AT+CSQ");
    delay(1000);
    response = "";
    while (SerialAT.available()) {
        response += SerialAT.readString();
    }
    
    // Parsear respuesta CSQ: +CSQ: <rssi>,<ber>
    int rssiStart = response.indexOf(": ") + 2;
    int rssiEnd = response.indexOf(",", rssiStart);
    if (rssiStart > 1 && rssiEnd > rssiStart) {
        int rssi = response.substring(rssiStart, rssiEnd).toInt();
        
        Serial.printf("📶 RSSI: %d", rssi);
        if (rssi >= 15) {
            Serial.println(" (Excelente)");
        } else if (rssi >= 10) {
            Serial.println(" (Buena)");
        } else if (rssi >= 5) {
            Serial.println(" (Regular)");
        } else if (rssi >= 2) {
            Serial.println(" (Pobre)");
        } else {
            Serial.println(" (Sin señal)");
            Serial.println("❌ Señal insuficiente para conexión datos");
            return false;
        }
    }
    
    // Paso 6: Estado de la red
    Serial.println("\n🌐 Estado de red:");
    SerialAT.println("AT+CREG?");
    delay(1000);
    response = "";
    while (SerialAT.available()) {
        response += SerialAT.readString();
    }
    
    if (response.indexOf(",1") >= 0 || response.indexOf(",5") >= 0) {
        Serial.println("✅ Registrado en red móvil");
    } else {
        Serial.println("❌ No registrado en red");
        Serial.println("💡 Posibles causas:");
        Serial.println("   • Señal débil");
        Serial.println("   • SIM sin crédito/plan datos");
        Serial.println("   • Área sin cobertura Movistar");
        return false;
    }
    
    // Paso 7: Configuración APN
    Serial.println("\n🔧 Configurando APN Movistar Ecuador...");
    SerialAT.println("AT+SAPBR=3,1,\"CONTYPE\",\"GPRS\"");
    delay(500);
    SerialAT.println("AT+SAPBR=3,1,\"APN\",\"" + String(GPRS_APN) + "\"");
    delay(500);
    
    if (strlen(GPRS_USER) > 0) {
        SerialAT.println("AT+SAPBR=3,1,\"USER\",\"" + String(GPRS_USER) + "\"");
        delay(500);
    }
    if (strlen(GPRS_PASS) > 0) {
        SerialAT.println("AT+SAPBR=3,1,\"PWD\",\"" + String(GPRS_PASS) + "\"");
        delay(500);
    }
    
    Serial.println("✅ APN configurado: " + String(GPRS_APN));
    
    // Paso 8: Test de conexión GPRS
    Serial.println("\n🌐 Probando conexión GPRS...");
    SerialAT.println("AT+SAPBR=1,1");
    delay(5000); // Dar tiempo para la conexión
    
    SerialAT.println("AT+SAPBR=2,1");
    delay(2000);
    response = "";
    while (SerialAT.available()) {
        response += SerialAT.readString();
    }
    
    if (response.indexOf("1,1,") >= 0) {
        Serial.println("✅ Conexión GPRS establecida");
        
        // Mostrar IP asignada
        int ipStart = response.indexOf("1,1,\"") + 5;
        int ipEnd = response.indexOf("\"", ipStart);
        if (ipStart > 4 && ipEnd > ipStart) {
            String ip = response.substring(ipStart, ipEnd);
            Serial.println("📱 IP asignada: " + ip);
        }
        
        // Paso 9: Test de conectividad real con ping
        Serial.println("\n� Test de conectividad real...");
        SerialAT.println("AT+HTTPINIT");
        delay(1000);
        SerialAT.println("AT+HTTPPARA=\"CID\",1");
        delay(500);
        SerialAT.println("AT+HTTPPARA=\"URL\",\"http://www.google.com\"");
        delay(500);
        SerialAT.println("AT+HTTPACTION=0");
        delay(3000);
        
        // Verificar respuesta HTTP
        SerialAT.println("AT+HTTPREAD");
        delay(2000);
        String httpResponse = "";
        while (SerialAT.available()) {
            httpResponse += SerialAT.readString();
        }
        
        SerialAT.println("AT+HTTPTERM");
        delay(500);
        
        if (httpResponse.indexOf("200") >= 0) {
            Serial.println("✅ Conectividad HTTP confirmada");
            Serial.println("�🎉 === CONEXIÓN 2G COMPLETAMENTE FUNCIONAL ===");
        } else {
            Serial.println("⚠️ GPRS conectado pero sin acceso HTTP");
            Serial.println("💡 Posible problema de DNS o firewall del operador");
        }
        
        Serial.println("🎉 === DIAGNÓSTICO 2G EXITOSO ===\n");
        return true;
    } else {
        Serial.println("❌ Fallo en conexión GPRS");
        Serial.println("💡 Verificar:");
        Serial.println("   • Crédito en SIM");
        Serial.println("   • Plan de datos activo");
        Serial.println("   • APN correcto para Movistar Ecuador");
        Serial.println("   • Cobertura 2G en la zona");
        
        // Intentar soluciones automáticas
        Serial.println("\n🔄 Intentando soluciones automáticas...");
        
        // Solución 1: Cambiar a búsqueda manual de red
        Serial.println("🔧 Solución 1: Registro manual en red Movistar...");
        SerialAT.println("AT+COPS=1,2,\"73402\""); // MCC+MNC de Movistar Ecuador
        delay(10000); // Dar tiempo para registro
        
        // Verificar registro
        SerialAT.println("AT+CREG?");
        delay(1000);
        response = "";
        while (SerialAT.available()) {
            response += SerialAT.readString();
        }
        
        if (response.indexOf(",1") >= 0 || response.indexOf(",5") >= 0) {
            Serial.println("✅ Registrado manualmente - Reintentando GPRS...");
            SerialAT.println("AT+SAPBR=1,1");
            delay(5000);
            
            SerialAT.println("AT+SAPBR=2,1");
            delay(2000);
            response = "";
            while (SerialAT.available()) {
                response += SerialAT.readString();
            }
            
            if (response.indexOf("1,1,") >= 0) {
                Serial.println("✅ Conexión GPRS establecida tras registro manual");
                return true;
            }
        }
        
        // Solución 2: Probar APN alternativo
        Serial.println("🔧 Solución 2: Probando APN alternativo...");
        SerialAT.println("AT+SAPBR=0,1"); // Cerrar conexión actual
        delay(2000);
        
        SerialAT.println("AT+SAPBR=3,1,\"APN\",\"bam.entelpcs.ec\""); // APN alternativo Ecuador
        delay(500);
        SerialAT.println("AT+SAPBR=1,1");
        delay(5000);
        
        SerialAT.println("AT+SAPBR=2,1");
        delay(2000);
        response = "";
        while (SerialAT.available()) {
            response += SerialAT.readString();
        }
        
        if (response.indexOf("1,1,") >= 0) {
            Serial.println("✅ Conexión exitosa con APN alternativo");
            return true;
        }
        
        Serial.println("❌ Todas las soluciones automáticas fallaron");
        Serial.println("🔧 ACCIONES MANUALES REQUERIDAS:");
        Serial.println("   1. Verificar que la SIM tenga plan de datos activo");
        Serial.println("   2. Verificar crédito suficiente");
        Serial.println("   3. Contactar a Movistar para verificar configuración");
        Serial.println("   4. Probar en área con mejor cobertura 2G");
        Serial.println("   5. Verificar que la SIM no esté bloqueada");
        
        return false;
    }
}

// — Test de conectividad al backend
bool testConectividadBackend() {
    Serial.println("\n🌐 === TEST CONECTIVIDAD BACKEND ===");
    
    // Verificar conexión disponible
    ConnStatus connectionStatus = checkConnectionLegacy();
    
    if (connectionStatus != CONN_OK) {
        Serial.println("❌ No hay conexión a internet disponible");
        Serial.println("💡 Ejecutar diagnóstico de conexión primero");
        return false;
    }
    
    // Determinar método de conexión
    String connectionMethod = "Unknown";
    if (WiFi.status() == WL_CONNECTED) {
        connectionMethod = "WiFi";
        Serial.println("📶 Usando conexión WiFi");
    } else if (modem.isGprsConnected()) {
        connectionMethod = "2G/GPRS";
        Serial.println("📱 Usando conexión 2G/GPRS");
    }
    
    // Test básico al endpoint /api/test
    Serial.println("🔧 Probando endpoint /api/test...");
    
    HTTPClient http;
    String testUrl = String(API_BASE) + "/api/test";
    
    Serial.println("🌐 URL: " + testUrl);
    
    http.begin(testUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("User-Agent", "OniChip-ESP32/1.0");
    http.setTimeout(10000); // 10 segundos timeout
    
    // Enviar request GET al endpoint test
    unsigned long startTime = millis();
    int httpCode = http.GET();
    unsigned long responseTime = millis() - startTime;
    
    Serial.printf("⏱️ Tiempo de respuesta: %lums\n", responseTime);
    Serial.printf("📋 Código HTTP: %d\n", httpCode);
    
    bool success = false;
    
    if (httpCode > 0) {
        String payload = http.getString();
        Serial.println("📨 Respuesta del servidor:");
        Serial.println(payload);
        
        if (httpCode == 200) {
            Serial.println("✅ Backend respondió correctamente");
            
            // Verificar contenido de respuesta específico del servidor
            if (payload.indexOf("{") >= 0) {
                Serial.println("📋 Respuesta en formato JSON detectada");
                
                // Verificar estructura JSON específica del servidor
                if (payload.indexOf("\"message\"") >= 0 && payload.indexOf("\"timestamp\"") >= 0) {
                    Serial.println("🎯 Estructura JSON válida del servidor OniChip");
                    
                    // Extraer y mostrar mensaje del servidor
                    int messageStart = payload.indexOf("\"message\":\"") + 11;
                    int messageEnd = payload.indexOf("\",", messageStart);
                    if (messageStart > 10 && messageEnd > messageStart) {
                        String serverMessage = payload.substring(messageStart, messageEnd);
                        Serial.println("💬 Mensaje del servidor: " + serverMessage);
                    }
                    
                    // Extraer y validar timestamp
                    int timestampStart = payload.indexOf("\"timestamp\":\"") + 13;
                    int timestampEnd = payload.indexOf("\"", timestampStart);
                    if (timestampStart > 12 && timestampEnd > timestampStart) {
                        String serverTimestamp = payload.substring(timestampStart, timestampEnd);
                        Serial.println("⏰ Timestamp del servidor: " + serverTimestamp);
                        
                        // Verificar que el timestamp sea reciente (formato ISO)
                        if (serverTimestamp.indexOf("2025") >= 0) {
                            Serial.println("✅ Timestamp válido - Servidor sincronizado");
                        } else {
                            Serial.println("⚠️ Timestamp inusual - Verificar fecha del servidor");
                        }
                    }
                    
                    // Verificar latencia del servidor
                    if (responseTime < 1000) {
                        Serial.println("🚀 Latencia excelente (<1s)");
                    } else if (responseTime < 3000) {
                        Serial.println("✅ Latencia buena (<3s)");
                    } else if (responseTime < 5000) {
                        Serial.println("⚠️ Latencia regular (<5s)");
                    } else {
                        Serial.println("❌ Latencia alta (>5s) - Posible problema de red");
                    }
                    
                } else {
                    Serial.println("⚠️ JSON válido pero estructura inesperada");
                    Serial.println("💡 El servidor respondió pero no con el formato esperado");
                }
            } else {
                Serial.println("⚠️ Respuesta no es JSON");
                Serial.println("💡 El servidor respondió pero no en formato JSON esperado");
            }
            
            success = true;
        } else if (httpCode == 404) {
            Serial.println("⚠️ Endpoint /api/test no encontrado");
            Serial.println("💡 Verificar que el backend tenga este endpoint");
        } else if (httpCode >= 500) {
            Serial.println("❌ Error del servidor backend");
        } else {
            Serial.println("⚠️ Respuesta inesperada del servidor");
        }
    } else {
        Serial.printf("❌ Error en la petición HTTP: %s\n", http.errorToString(httpCode).c_str());
        
        // Diagnóstico específico de errores
        switch (httpCode) {
            case HTTPC_ERROR_CONNECTION_REFUSED:
                Serial.println("💡 El servidor rechazó la conexión");
                Serial.println("   • Verificar que el backend esté ejecutándose");
                Serial.println("   • Verificar puerto 3000");
                break;
            case HTTPC_ERROR_CONNECTION_LOST:
                Serial.println("💡 Conexión perdida durante la petición");
                Serial.println("   • Verificar estabilidad de la conexión");
                break;
            case HTTPC_ERROR_NO_STREAM:
                Serial.println("💡 No se pudo crear stream HTTP");
                break;
            case HTTPC_ERROR_NO_HTTP_SERVER:
                Serial.println("💡 No hay servidor HTTP en la dirección");
                Serial.println("   • Verificar IP: " + String(API_BASE));
                break;
            case HTTPC_ERROR_TOO_LESS_RAM:
                Serial.println("💡 Memoria RAM insuficiente");
                break;
            case HTTPC_ERROR_ENCODING:
                Serial.println("💡 Error de codificación");
                break;
            case HTTPC_ERROR_STREAM_WRITE:
                Serial.println("💡 Error escribiendo datos");
                break;
            case HTTPC_ERROR_READ_TIMEOUT:
                Serial.println("💡 Timeout leyendo respuesta");
                Serial.println("   • El servidor tardó más de 10s en responder");
                break;
            default:
                Serial.println("💡 Error HTTP desconocido");
                break;
        }
    }
    
    http.end();
    
    // Test adicional: DNS Resolution
    Serial.println("\n🔍 Test adicional de resolución DNS...");
    String host = String(API_BASE);
    host.replace("http://", "");
    host.replace("https://", "");
    int portIndex = host.indexOf(":");
    if (portIndex > 0) {
        host = host.substring(0, portIndex);
    }
    
    Serial.println("🌐 Resolviendo: " + host);
    
    // Solo para conexión WiFi podemos hacer ping
    if (WiFi.status() == WL_CONNECTED) {
        WiFiClient client;
        if (client.connect(host.c_str(), 3000)) {
            Serial.println("✅ Resolución DNS y conectividad TCP OK");
            client.stop();
        } else {
            Serial.println("❌ No se pudo conectar al host");
        }
    }
    
    // Resumen del test
    Serial.println("\n📊 === RESUMEN TEST BACKEND ===");
    Serial.println("🌐 Método: " + connectionMethod);
    Serial.printf("⏱️ Latencia: %lums\n", responseTime);
    Serial.printf("📋 Estado: %s (HTTP %d)\n", success ? "EXITOSO" : "FALLIDO", httpCode);
    Serial.println("🔗 Endpoint: /api/test");
    
    if (success) {
        Serial.println("✅ Backend OniChip completamente funcional");
        Serial.println("🎯 Servidor respondiendo correctamente");
        Serial.println("📡 Comunicación establecida exitosamente");
        Serial.println("🚀 Sistema listo para envío de datos GPS");
    } else {
        Serial.println("❌ Backend no accesible");
        Serial.println("💡 Verificar:");
        Serial.println("   • Servidor backend ejecutándose en puerto 3000");
        Serial.println("   • IP correcta en config.h: " + String(API_BASE));
        Serial.println("   • Firewall no bloqueando conexiones");
        Serial.println("   • Endpoint /api/test implementado correctamente");
        Serial.println("   • Red estable para peticiones HTTP");
    }
    
    Serial.println("🌐 === FIN TEST BACKEND ===\n");
    return success;
}

// — Diagnóstico completo de reconexión cuando no hay internet
void diagnosticoReconexion() {
    Serial.println("\n🔄 === DIAGNÓSTICO DE RECONEXIÓN ===");
    
    // Paso 1: Mostrar estado actual
    mostrarEstadoConexion();
    
    // Paso 2: Análisis de problemas y soluciones
    Serial.println("\n🔧 Análisis y soluciones de reconexión:");
    
    // Verificar WiFi si está habilitado
    if (WiFi.getMode() != WIFI_OFF) {
        Serial.println("\n📶 DIAGNÓSTICO WIFI:");
        
        if (WiFi.status() == WL_CONNECTED) {
            Serial.println("✅ WiFi conectado");
            Serial.println("📱 IP: " + WiFi.localIP().toString());
            Serial.println("📶 RSSI: " + String(WiFi.RSSI()) + " dBm");
        } else {
            Serial.println("❌ WiFi desconectado");
            Serial.printf("📋 Estado: %d\n", WiFi.status());
            
            // Intentar reconexión WiFi si hay credenciales
            Serial.println("🔄 Intentando reconexión WiFi...");
            WiFi.reconnect();
            
            unsigned long wifiTimeout = millis() + 10000; // 10 segundos
            while (WiFi.status() != WL_CONNECTED && millis() < wifiTimeout) {
                delay(500);
                Serial.print(".");
            }
            
            if (WiFi.status() == WL_CONNECTED) {
                Serial.println("\n✅ WiFi reconectado exitosamente");
            } else {
                Serial.println("\n❌ Fallo en reconexión WiFi");
                Serial.println("💡 Soluciones WiFi:");
                Serial.println("   • Verificar credenciales");
                Serial.println("   • Acercarse al router");
                Serial.println("   • Reiniciar router");
                Serial.println("   • Verificar banda (2.4GHz)");
            }
        }
    }
    
    // Verificar conexión móvil 2G
    Serial.println("\n📱 DIAGNÓSTICO CONEXIÓN MÓVIL:");
    
    if (!modem.isNetworkConnected()) {
        Serial.println("❌ Sin conexión a red móvil");
        Serial.println("🔄 Pasos de reconexión móvil:");
        
        // Paso 1: Reiniciar módem
        Serial.println("   1️⃣ Reiniciando módem SIM800...");
        modem.restart();
        delay(5000);
        
        // Paso 2: Verificar SIM
        Serial.println("   2️⃣ Verificando estado SIM...");
        if (modem.getSimStatus() != 3) {
            Serial.println("   ❌ Problema con SIM");
            Serial.println("   💡 Verificar:");
            Serial.println("      • SIM insertada correctamente");
            Serial.println("      • SIM no dañada");
            Serial.println("      • PIN correcto si aplica");
        } else {
            Serial.println("   ✅ SIM OK");
        }
        
        // Paso 3: Buscar red
        Serial.println("   3️⃣ Buscando operadores disponibles...");
        String operators = modem.getOperator();
        Serial.println("   📡 Operador: " + operators);
        
        // Paso 4: Verificar señal
        Serial.println("   4️⃣ Verificando calidad de señal...");
        int16_t signalQuality = modem.getSignalQuality();
        Serial.printf("   📶 Señal: %d/31\n", signalQuality);
        
        if (signalQuality < 5) {
            Serial.println("   ❌ Señal muy débil");
            Serial.println("   💡 Soluciones:");
            Serial.println("      • Mover a área con mejor cobertura");
            Serial.println("      • Verificar antena SIM800");
            Serial.println("      • Alejar de interferencias");
        }
        
        // Paso 5: Forzar registro en red
        Serial.println("   5️⃣ Forzando registro en red...");
        modem.sendAT("+COPS=0"); // Registro automático
        delay(10000); // Esperar registro
        
        if (modem.isNetworkConnected()) {
            Serial.println("   ✅ Red móvil reconectada");
        } else {
            Serial.println("   ❌ Fallo en reconexión móvil");
        }
        
    } else {
        Serial.println("✅ Conectado a red móvil");
        
        // Verificar GPRS
        if (!modem.isGprsConnected()) {
            Serial.println("❌ Sin conexión GPRS");
            Serial.println("🔄 Reconectando GPRS...");
            
            // Desconectar GPRS actual
            modem.gprsDisconnect();
            delay(2000);
            
            // Reconectar con APN
            if (modem.gprsConnect(GPRS_APN, GPRS_USER, GPRS_PASS)) {
                Serial.println("✅ GPRS reconectado");
            } else {
                Serial.println("❌ Fallo reconexión GPRS");
                Serial.println("💡 Verificar:");
                Serial.println("   • APN correcto: " + String(GPRS_APN));
                Serial.println("   • Crédito/plan datos activo");
                Serial.println("   • Cobertura 2G en la zona");
            }
        } else {
            Serial.println("✅ GPRS conectado");
        }
    }
    
    // Paso 3: Test de conectividad a internet
    Serial.println("\n🌐 TEST CONECTIVIDAD INTERNET:");
    
    ConnStatus finalStatus = checkConnectionLegacy();
    
    switch (finalStatus) {
        case CONN_OK:
            Serial.println("✅ Conexión a internet restaurada");
            
            // Test al backend
            Serial.println("🔧 Probando conectividad al backend...");
            if (testConectividadBackend()) {
                Serial.println("🎉 RECONEXIÓN COMPLETADA EXITOSAMENTE");
            } else {
                Serial.println("⚠️ Internet OK, pero backend no accesible");
            }
            break;
            
        case NO_NETWORK:
            Serial.println("❌ Sin conexión de red");
            Serial.println("💡 Soluciones finales:");
            Serial.println("   • Cambiar ubicación física");
            Serial.println("   • Verificar antenas");
            Serial.println("   • Contactar operador móvil");
            Serial.println("   • Verificar estado de SIM");
            break;
            
        case GPRS_FAIL:
            Serial.println("❌ Fallo GPRS persistente");
            Serial.println("💡 Soluciones finales:");
            Serial.println("   • Verificar crédito/plan datos");
            Serial.println("   • Contactar Movistar Ecuador");
            Serial.println("   • Probar con otra SIM");
            break;
    }
    
    // Paso 4: Recomendaciones finales
    Serial.println("\n📋 === RECOMENDACIONES FINALES ===");
    Serial.println("🔄 Si el problema persiste:");
    Serial.println("   1. Reiniciar completamente el dispositivo");
    Serial.println("   2. Verificar alimentación estable");
    Serial.println("   3. Comprobar todas las conexiones físicas");
    Serial.println("   4. Probar en diferente ubicación");
    Serial.println("   5. Verificar estado de SIM con teléfono");
    
    Serial.println("🔄 === FIN DIAGNÓSTICO RECONEXIÓN ===\n");
}

// — Mostrar estado actual de todas las conexiones
void mostrarEstadoConexion() {
    Serial.println("\n📊 === ESTADO ACTUAL DE CONEXIONES ===");
    
    // Estado WiFi
    Serial.println("📶 WIFI:");
    if (WiFi.getMode() == WIFI_OFF) {
        Serial.println("   ⚪ Deshabilitado");
    } else {
        switch (WiFi.status()) {
            case WL_CONNECTED:
                Serial.println("   ✅ Conectado");
                Serial.println("   📱 IP: " + WiFi.localIP().toString());
                Serial.println("   📶 RSSI: " + String(WiFi.RSSI()) + " dBm");
                Serial.println("   🌐 SSID: " + WiFi.SSID());
                break;
            case WL_DISCONNECTED:
                Serial.println("   ❌ Desconectado");
                break;
            case WL_CONNECTION_LOST:
                Serial.println("   ❌ Conexión perdida");
                break;
            case WL_NO_SSID_AVAIL:
                Serial.println("   ❌ Red no disponible");
                break;
            case WL_CONNECT_FAILED:
                Serial.println("   ❌ Fallo de conexión");
                break;
            default:
                Serial.printf("   ⚠️ Estado desconocido: %d\n", WiFi.status());
                break;
        }
    }
    
    // Estado módem y red móvil
    Serial.println("\n📱 CONEXIÓN MÓVIL (SIM800):");
    
    // Estado del módem
    if (modem.testAT()) {
        Serial.println("   ✅ Módem respondiendo");
        
        // Estado SIM
        int simStatus = modem.getSimStatus();
        Serial.printf("   🔐 Estado SIM: %d ", simStatus);
        switch (simStatus) {
            case 0: Serial.println("(SIM no detectada)"); break;
            case 1: Serial.println("(SIM lista)"); break;
            case 2: Serial.println("(SIM con PIN)"); break;
            case 3: Serial.println("(SIM OK)"); break;
            default: Serial.println("(Estado desconocido)"); break;
        }
        
        // Operador
        String operator_name = modem.getOperator();
        Serial.println("   📡 Operador: " + operator_name);
        
        // Calidad de señal
        int16_t signal = modem.getSignalQuality();
        Serial.printf("   📶 Señal: %d/31 ", signal);
        if (signal >= 20) Serial.println("(Excelente)");
        else if (signal >= 15) Serial.println("(Buena)");
        else if (signal >= 10) Serial.println("(Regular)");
        else if (signal >= 5) Serial.println("(Pobre)");
        else Serial.println("(Sin señal)");
        
        // Estado de red
        if (modem.isNetworkConnected()) {
            Serial.println("   ✅ Registrado en red");
            
            // Estado GPRS
            if (modem.isGprsConnected()) {
                Serial.println("   ✅ GPRS conectado");
                Serial.println("   🌐 APN: " + String(GPRS_APN));
            } else {
                Serial.println("   ❌ GPRS desconectado");
            }
        } else {
            Serial.println("   ❌ Sin registro en red");
        }
        
    } else {
        Serial.println("   ❌ Módem no responde");
    }
    
    // Estado general de conectividad
    Serial.println("\n🌐 CONECTIVIDAD GENERAL:");
    Serial.printf("   📡 Estado actual: %s\n", 
                 currentConnection == CONN_WIFI ? "WiFi" :
                 currentConnection == CONN_2G ? "Datos Móviles 2G" : "Desconectado");
    Serial.printf("   🌍 Internet: %s\n", isConnectedToInternet ? "✅ Disponible" : "❌ No disponible");
    
    // Test rápido de backend
    if (isConnectedToInternet) {
        Serial.print("   🔍 Test backend: ");
        bool backendOK = checkConnection();
        Serial.printf("%s\n", backendOK ? "✅ OK" : "❌ Fallo");
    }
    ConnStatus status = checkConnectionLegacy();
    switch (status) {
        case CONN_OK:
            Serial.println("   ✅ Conexión a internet disponible");
            if (WiFi.status() == WL_CONNECTED) {
                Serial.println("   📶 Método: WiFi");
            } else if (modem.isGprsConnected()) {
                Serial.println("   📱 Método: 2G/GPRS");
            }
            break;
        case NO_NETWORK:
            Serial.println("   ❌ Sin conexión de red");
            break;
        case GPRS_FAIL:
            Serial.println("   ❌ Fallo en conexión GPRS");
            break;
    }
    
    // Información del sistema
    Serial.println("\n💾 SISTEMA:");
    Serial.printf("   🔋 Memoria libre: %d bytes\n", ESP.getFreeHeap());
    Serial.printf("   ⏱️ Uptime: %lu ms\n", millis());
    Serial.printf("   🔧 Chip Rev: %d\n", ESP.getChipRevision());
    
    Serial.println("📊 === FIN ESTADO CONEXIONES ===\n");
}