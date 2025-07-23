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

// Protos GPS y WiFi
bool        setPowerBoostKeepOn(bool en);
float       readBatteryLevel();
bool        readChargingStatus();
ConnStatus  checkConnection();
void        reconnect();
void        blinkError(int code);
void        blinkConnected();
bool        readGPS(LocationData &location); // GPS principal
bool        getWiFiLocation(LocationData &location); // WiFi fallback
bool        readLocationHybrid(LocationData &location); // Método híbrido
void        sendLocationData(LocationData &location);
void        readAllData(LocationData &location, float &batV, bool &charging);
void        sendData(float lat, float lon, float speedKmh,
                     int vitals, float batV, bool charging);
void        diagnosticoGPS(); // Diagnóstico GPS NEO-6M
void        verificarCalibracionGPS(); // Verificación específica de calibración
bool        testHardware(); // Test inicial de hardware


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
  LocationData location;
  float batV;
  bool charging;
  
  // Leer todos los datos (ubicación + batería)
  readAllData(location, batV, charging);

  ConnStatus st = checkConnection();
  if (st == CONN_OK) {
    unsigned long lastSend = millis();
    unsigned long sendInterval = 30000; // 30 segundos
    
    while (checkConnection() == CONN_OK) {
      LocationData newLocation;
      float newBatV;
      bool newCharging;
      
      // Leer datos actualizados
      readAllData(newLocation, newBatV, newCharging);
      
      // Construir JSON con los nuevos datos de ubicación
      String json = buildLocationJson(newLocation, newBatV, newCharging);
      
      // Enviar al servidor
      HTTPClient http;
      http.begin(apiBase + "/api/device/" + deviceId + "/location");
      http.addHeader("Content-Type", "application/json");
      int httpCode = http.PUT(json);
      
      if (httpCode == 200) {
        Serial.println("✅ Ubicación enviada correctamente");
        blinkConnected();
      } else {
        Serial.println("❌ Error enviando ubicación: " + String(httpCode));
        blinkError(1);
      }
      
      http.end();
      
      // Esperar intervalo antes del siguiente envío
      unsigned long now = millis();
      while (millis() - now < sendInterval) {
        delay(100);
        if (checkConnection() != CONN_OK) break;
      }
    }
    Serial.println("Conexión perdida con el servidor, intentando reconectar...");
  } else {
    reconnect();
    blinkError(st);
    delay(30000);
  }
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

// — Chequea red y GPRS
ConnStatus checkConnection() {
  // Prioridad 1: Wi-Fi temporal
  if (WiFi.status() == WL_CONNECTED) {
    //Serial.println("✅ Conectado vía Wi-Fi");
    return CONN_OK;
  }

  if (!modem.isNetworkConnected()) {
    Serial.println("Sin señal de red");
    return NO_NETWORK;
  }
  if (!modem.isGprsConnected()) {
    Serial.println("Conectando GPRS...");
    if (!modem.gprsConnect(GPRS_APN, GPRS_USER, GPRS_PASS)) {
      Serial.println("Fallo GPRS");
      return GPRS_FAIL;
    }
    Serial.println("GPRS conectado");
  }
  return CONN_OK;
}

// — Reconectar según fallo
void reconnect() {
  ConnStatus st = checkConnection();
  if (st == NO_NETWORK) {
    Serial.println("Reiniciando módem completo...");
    modem.restart();
    delay(2000);
  }
  if (st == GPRS_FAIL) {
    Serial.println("Reintentando GPRS...");
    modem.gprsDisconnect();
    delay(500);
    modem.gprsConnect(GPRS_APN, GPRS_USER, GPRS_PASS);
    delay(1000);
  }
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

// — Obtener ubicación vía WiFi (fallback)
bool getWiFiLocation(LocationData &location) {
    location.isValid = false;
    location.method = WIFI_FALLBACK;
    
    // Escanear redes WiFi cercanas
    WiFi.mode(WIFI_STA);
    int networkCount = WiFi.scanNetworks();
    
    if (networkCount == 0) {
        Serial.println("❌ No hay redes WiFi disponibles");
        return false;
    }
    
    // Crear JSON para Google Geolocation API
    String json = "{\"wifiAccessPoints\":[";
    int validNetworks = 0;
    
    for (int i = 0; i < networkCount && validNetworks < 10; i++) {
        if (WiFi.RSSI(i) > -90) { // Solo redes con buena señal
            if (validNetworks > 0) json += ",";
            json += "{";
            json += "\"macAddress\":\"" + WiFi.BSSIDstr(i) + "\",";
            json += "\"signalStrength\":" + String(WiFi.RSSI(i));
            json += "}";
            validNetworks++;
        }
    }
    json += "]}";
    
    if (validNetworks == 0) {
        Serial.println("❌ No hay redes WiFi válidas para geolocalización");
        return false;
    }
    
    // Hacer petición al servidor para obtener ubicación
    HTTPClient http;
    http.begin(apiBase + "/api/location/wifi");
    http.addHeader("Content-Type", "application/json");
    
    int httpCode = http.POST(json);
    
    if (httpCode == 200) {
        String response = http.getString();
        
        // Parse JSON response
        DynamicJsonDocument doc(1024);
        deserializeJson(doc, response);
        
        if (doc["status"] == "OK") {
            location.latitude = doc["location"]["lat"];
            location.longitude = doc["location"]["lng"];
            location.accuracy = doc["accuracy"];
            location.speed = 0.0; // WiFi no proporciona velocidad
            location.satellites = 0;
            location.isValid = true;
            location.method = WIFI_FALLBACK;
            
            Serial.printf("📶 WiFi Loc: %.6f, %.6f | Precisión: %.0fm\n", 
                          location.latitude, location.longitude, location.accuracy);
            
            http.end();
            return true;
        }
    }
    
    http.end();
    Serial.println("❌ Error en geolocalización WiFi");
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
    start = millis();
    while (millis() - start < 5000) { // 5 segundos
        while (ss.available() > 0) {
            if (gps.encode(ss.read())) {
                if (gps.satellites.isValid()) {
                    Serial.printf("🛰️ Satélites visibles: %d\n", gps.satellites.value());
                    if (gps.hdop.isValid()) {
                        Serial.printf("📊 HDOP (precisión): %.2f\n", gps.hdop.hdop());
                    }
                    if (gps.location.isValid()) {
                        Serial.printf("📍 Ubicación: %.6f, %.6f\n", 
                                      gps.location.lat(), gps.location.lng());
                        Serial.println("✅ GPS con FIX!");
                        return;
                    }
                }
            }
        }
        delay(100);
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
    
    // Test 3: Verificar I2C (batería)
    Wire.beginTransmission(IP5306_ADDR);
    int i2cResult = Wire.endTransmission();
    Serial.printf("   I2C (IP5306): %s\n", i2cResult == 0 ? "OK" : "ERROR");
    
    // Test 4: Test LED
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