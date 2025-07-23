// =================== [TEST WIFI SECTION - REMOVE FOR PRODUCTION] ===================
// Este bloque permite conectar a WiFi para pruebas sin SIM/GPRS
// Puedes eliminarlo fácilmente quitando esta sección.
#ifdef TEST_WIFI
#include <WiFi.h>
const char* ssid = "AndroidAP";
const char* password = "12345678";
void connectTestWiFi() {
  Serial.println("Conectando a WiFi...");
  WiFi.begin(ssid, password);
  int wifiTries = 0;
  while (WiFi.status() != WL_CONNECTED && wifiTries < 20) {
    delay(500);
    Serial.print(".");
    wifiTries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi conectado. IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nNo se pudo conectar a WiFi");
  }
}
#endif
// =================== [END TEST WIFI SECTION] ===================
