// ====================== config.h ======================
#ifndef CONFIG_H
#define CONFIG_H


// Unique identifier for this tracker device
#define DEVICE_ID    "collar-test"
#define API_BASE     "https://onichip.xyz"


// ————— SIM & GPRS —————
#define SIM_PIN             ""                  // PIN de la SIM si aplica
#define GPRS_APN            "internet.movistar.ec"  // APN configurado para Ecuador
#define GPRS_USER           ""                  // Usuario GPRS si aplica
#define GPRS_PASS           ""                  // Password GPRS si aplica

// NOTA: Geolocalización configurada específicamente para Quito, Ecuador
// - MCC: 740 (Ecuador)
// - MNC: 0 (Movistar Ecuador como operador por defecto)
// - LAC: 100 (Zona Norte de Quito)
// - CellID: 2010 (Área metropolitana)

// ————— LILYGO T-Call v1.4 Pins —————
#define MODEM_RST_PIN       5   // SIM800 Reset
#define MODEM_PWKEY_PIN     4   // SIM800 Power Key  
#define MODEM_POWERON_PIN   23  // SIM800 Power On
#define MODEM_TX_PIN        27  // ESP32 TX → SIM800L RX
#define MODEM_RX_PIN        26  // ESP32 RX ← SIM800L TX
#define STATUS_LED_PIN      13  // LED integrado

// ————— GPS NEO-6M - Pines disponibles en T-Call v1.4 —————
// Pines seguros y disponibles en T-Call v1.4:
#define GPS_TX_PIN          33  // ESP32 RX ← GPS TX (datos del GPS)
#define GPS_RX_PIN          32  // ESP32 TX → GPS RX (comandos al GPS) 

// ————— I²C Power (IP5306) —————
#define I2C_SDA_POWER       21
#define I2C_SCL_POWER       22
#define IP5306_ADDR         0x75
#define IP5306_REG_SYS_CTL0 0x00

// ————— Sensores —————
#define VITALS_PIN          34    // Entrada analógica para signos vitales
#define BATT_PIN            35    // Entrada analógica para medición de batería

// ————— Timings LED (ms) —————
#define BLINK_ON_MS         100
#define BLINK_OFF_MS        100
#define ERROR_PAUSE_MS      300
#define OK_ON_MS            1000
#define OK_OFF_MS           1000

// ————— HTTP/GPRS —————
#define HTTP_PORT           80

#endif // CONFIG_H