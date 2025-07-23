// ====================== GPS_TRACKER.ino ======================
// 🗺️ SISTEMA DE RASTREO GPS ONICHIP
// Funciones principales: GPS + WiFi Fallback + Geofencing

// Selección de módem SIM800 para TinyGSM
#define TINY_GSM_MODEM_SIM800

#include "config.h"

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


void setup() {
  Serial.begin(115200);
  delay(10);
  SPIFFS.begin(true);

  // =================== [TEST WIFI SECTION - REMOVE FOR PRODUCTION] ===================
  // Modular: solo incluye y llama si TEST_WIFI está definido
  connectTestWiFi();
  // =================== [END TEST WIFI SECTION] ===================

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

  // Inicia UART al SIM800L
  SerialAT.begin(115200, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
  delay(3000);
  Serial.println("Iniciando módem...");
  modem.restart();

  // Configura el GPS (SoftwareSerial)
  ss.begin(9600);
  Serial.println("Iniciando GPS...");

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

// — Lectura GPS principal
bool readGPS(LocationData &location) {
    location.isValid = false;
    location.method = GPS_ONLY;
    location.timestamp = millis();
    
    // Leer datos GPS durante 2 segundos
    unsigned long start = millis();
    while (millis() - start < 2000) {
        while (ss.available() > 0) {
            if (gps.encode(ss.read())) {
                if (gps.location.isValid()) {
                    location.latitude = gps.location.lat();
                    location.longitude = gps.location.lng();
                    location.speed = gps.speed.isValid() ? gps.speed.kmph() : 0.0;
                    location.accuracy = gps.hdop.isValid() ? gps.hdop.hdop() : 999.0;
                    location.satellites = gps.satellites.isValid() ? gps.satellites.value() : 0;
                    location.isValid = true;
                    location.method = GPS_ONLY;
                    
                    Serial.printf("🛰️ GPS: %.6f, %.6f | Vel: %.2f km/h | Sats: %d\n", 
                                  location.latitude, location.longitude, location.speed, location.satellites);
                    return true;
                }
            }
        }
    }
    
    Serial.println("❌ GPS no disponible");
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
        json += "\"method\":\"" + (location.method == GPS_ONLY ? "GPS" : "WiFi") + "\"";
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
