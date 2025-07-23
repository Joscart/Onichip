// ====================== tracker.ino ======================

// Selección de módem SIM800 para TinyGSM
#define TINY_GSM_MODEM_SIM800

#include "config.h"

#include <Wire.h>
#include <TinyGsmClient.h>
#include <TinyGPSPlus.h>
#include <SoftwareSerial.h>
#include <HTTPClient.h>
#include <SPIFFS.h>

#define TINY_GSM_RX_BUFFER 1024


// UART y cliente TinyGSM

HardwareSerial SerialAT(2);
TinyGsm        modem(SerialAT);
TinyGsmClient  client(modem);
TinyGPSPlus gps;
SoftwareSerial ss(GPS_TX_PIN, GPS_RX_PIN); // GPS TX → ESP32 RX, GPS RX ← ESP32 TX

// Configuración API (ver config.h)
#include "config.h"
String deviceId = DEVICE_ID;
String apiBase = API_BASE;

// =================== [TEST WIFI SECTION - REMOVE FOR PRODUCTION] ===================
  // Modular: solo incluye y llama si TEST_WIFI está definido
#define TEST_WIFI
#include "test.h"
// =================== [END TEST WIFI SECTION] ===================

// Estados de conexión
enum ConnStatus { CONN_OK = 0, NO_NETWORK, GPRS_FAIL };

// Protos
bool        setPowerBoostKeepOn(bool en);
float       readBatteryLevel();
bool        readChargingStatus();
ConnStatus  checkConnection();
void        reconnect();
void        blinkError(int code);
void        blinkConnected();
bool        readGps(float &lat, float &lon, float &speedKmh);
void        readData(float &lat, float &lon, float &speedKmh,
                     int &vitals, float &batV, bool &charging);
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
  float lat, lon, speedKmh, batV;
  int vitals;
  bool charging;
  readData(lat, lon, speedKmh, vitals, batV, charging);

  ConnStatus st = checkConnection();
  if (st == CONN_OK) {
    unsigned long lastSend = millis();
    unsigned long sendInterval = 30000; // 30 segundos
    while (checkConnection() == CONN_OK) {
      float lat2, lon2, speedKmh2, batV2;
      int vitals2;
      bool charging2;
      readData(lat2, lon2, speedKmh2, vitals2, batV2, charging2);
      String json = buildJson(lat2, lon2, speedKmh2, vitals2, batV2, charging2);
      HTTPClient http;
      http.begin(apiBase + "/dev/" + deviceId);
      http.addHeader("Content-Type", "application/json");
      int httpCode = http.PUT(json);
      Serial.println("PUT status: " + String(httpCode));
      http.end();
      blinkConnected();
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

// - Lectura GPS
bool readGps(float &lat, float &lon, float &speedKmh) {
  // Leer datos del GPS usando SoftwareSerial
  while (ss.available() > 0) {
    gps.encode(ss.read());
  }
  if (gps.location.isValid() && gps.location.age() < 2000) {
    lat = gps.location.lat();
    lon = gps.location.lng();
    speedKmh = gps.speed.kmph();
    return true;
  }

  String json = String(buildWifiJson());
  HTTPClient http;
  http.begin(apiBase+"/geoloc/wifi");
  http.addHeader("Content-Type", "application/json");
  int httpCode = http.POST(json);
  Serial.println("POST status: " + String(httpCode));
  http.end();

  return false;
}

String buildWifiJson() {
  int n = WiFi.scanNetworks();
  String json = "{\"wifiAccessPoints\":[";
  for (int i = 0; i < n; i++) {
    if (i > 0) json += ",";
    json += "{";
    json += "\"macAddress\":\"" + WiFi.BSSIDstr(i) + "\",";
    json += "\"signalStrength\":" + String(WiFi.RSSI(i));
    json += "}";
  }
  json += "]}";
  return json;
}

// — Lectura local e impresión
void readData(float &lat, float &lon, float &speedKmh,
              int &vitals, float &batV, bool &charging) {

  bool gpsOk = readGps(lat, lon, speedKmh);
  vitals   = analogRead(VITALS_PIN);
  batV     = readBatteryLevel();
  charging = readChargingStatus();

  if (gpsOk) {
    Serial.printf(
      ">> GPS: %.6f, %.6f | Vel: %.2f km/h | Vitales: %d | Batería: %.2f V | Carga: %s\n",
      lat, lon, speedKmh, vitals, batV,
      charging ? "Sí" : "No"
    );
  } else {
    Serial.printf(
      ">> GPS no dispo | Vitales: %d | Batería: %.2f V | Carga: %s\n",
      vitals, batV, charging ? "Sí" : "No"
    );
  }
}
