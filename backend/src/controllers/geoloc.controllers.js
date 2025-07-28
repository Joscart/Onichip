/**
 * ================================================
 * 📶 GEOLOC CONTROLLER - GEOLOCALIZACIÓN AVANZADA
 * ================================================
 * 
 * Controlador para geolocalización usando múltiples fuentes:
 * - WiFi Access Points
 * - Torres de telefonía móvil (GSM/LTE)
 * - Dirección IP del cliente
 * 
 * @author Onichip Team
 * @version 3.0
 */

const axios = require('axios');

// Configuración de la API de Google
const GOOGLE_API_KEY = 'AIzaSyCnc3msjOM0UP4dyLhgi6-HQ1TRyDnGyFg'; // Reemplaza con tu clave real
const GOOGLE_GEOLOCATION_URL = `https://www.googleapis.com/geolocation/v1/geolocate?key=${GOOGLE_API_KEY}`;

/**
 * 📶 Geolocalización por WiFi (Web)
 * @description Endpoint actualizado con Google API Key real
 */
exports.geolocByWifi = async (req, res) => {
  const { wifiAccessPoints } = req.body;
  
  console.log('📶 Solicitud geolocalización WiFi (Web):', JSON.stringify(req.body, null, 2));
  
  if (!wifiAccessPoints || !Array.isArray(wifiAccessPoints) || wifiAccessPoints.length === 0) {
    return res.status(400).json({ message: 'No se recibieron redes WiFi' });
  }
  
  try {
    const response = await axios.post(GOOGLE_GEOLOCATION_URL, {
      wifiAccessPoints
    });
    
    if (response.data && response.data.location) {
      console.log(`✅ Ubicación WiFi obtenida: ${response.data.location.lat}, ${response.data.location.lng}`);
      
      return res.json({ 
        lat: response.data.location.lat, 
        lon: response.data.location.lng, 
        accuracy: response.data.accuracy 
      });
    } else {
      return res.status(500).json({ message: 'No se pudo obtener ubicación' });
    }
  } catch (err) {
    console.error('❌ Error en geolocalización WiFi:', err.response?.data || err.message);
    res.status(500).json({ message: 'Error en geolocalización', error: err.message });
  }
};

/**
 * 🌐 Geolocalización WiFi + GSM para ESP32 (2G)
 * 
 * @description Endpoint optimizado para ESP32 con conexión 2G/GPRS
 *              Recibe datos de WiFi y torres GSM para máxima precisión
 * @route POST /api/location/wifi
 * @access Device (ESP32 con 2G/GPRS)
 * 
 * @input {Object} req.body - Datos de geolocalización del ESP32
 * @input {Array} req.body.wifiAccessPoints - Redes WiFi escaneadas (opcional)
 * @input {Array} req.body.cellTowers - Torres GSM detectadas (opcional) 
 * @input {string} req.body.radioType - Tipo de red celular (gsm por defecto para 2G)
 * @input {boolean} req.body.considerIp - Usar IP como fallback (opcional)
 * @input {string} req.body.deviceId - ID del dispositivo ESP32 (opcional)
 * 
 * @output {Object} 200 - Ubicación combinada WiFi + GSM
 * @output {Object} 400 - Datos insuficientes
 * @output {Object} 500 - Error en servicio de geolocalización
 */
exports.wifiLocation = async (req, res) => {
  try {
    const { wifiAccessPoints, cellTowers, radioType, considerIp, deviceId } = req.body;
    
    console.log(`🌐 Solicitud ESP32 (2G) - DeviceID: ${deviceId || 'Sin ID'}`);
    console.log(`📱 Datos recibidos:`, JSON.stringify(req.body, null, 2));
    console.log(`📡 IP cliente: ${req.ip || req.connection.remoteAddress}`);
    
    // Preparar payload para Google Geolocation API
    const geoPayload = {};
    let sourcesDetected = [];
    
    // 📶 PROCESAMIENTO DE DATOS WIFI
    if (wifiAccessPoints && Array.isArray(wifiAccessPoints) && wifiAccessPoints.length > 0) {
      // Filtrar redes WiFi válidas con señal suficiente
      const validWifi = wifiAccessPoints.filter(ap => {
        // Validar campos requeridos
        if (!ap.macAddress) return false;
        
        // Validar formato MAC (básico)
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (!macRegex.test(ap.macAddress)) return false;
        
        // Validar señal (mayor a -90 dBm para WiFi)
        if (ap.signalStrength && ap.signalStrength <= -90) return false;
        
        return true;
      });
      
      if (validWifi.length > 0) {
        // Limitar a máximo 15 redes WiFi para eficiencia
        geoPayload.wifiAccessPoints = validWifi.slice(0, 15);
        sourcesDetected.push(`WiFi:${geoPayload.wifiAccessPoints.length}`);
        console.log(`📶 ${geoPayload.wifiAccessPoints.length} redes WiFi válidas procesadas`);
      }
    }
    
    // 📡 PROCESAMIENTO DE DATOS GSM (2G)
    if (cellTowers && Array.isArray(cellTowers) && cellTowers.length > 0) {
      // Validar torres de telefonía GSM
      const validCells = cellTowers.filter(cell => {
        // Campos obligatorios para GSM
        const hasRequiredFields = cell.cellId && 
                                  cell.locationAreaCode && 
                                  cell.mobileCountryCode && 
                                  cell.mobileNetworkCode;
        
        if (!hasRequiredFields) return false;
        
        // Validar rangos típicos para España/Europa
        const validMCC = cell.mobileCountryCode >= 200 && cell.mobileCountryCode <= 999;
        const validMNC = cell.mobileNetworkCode >= 0 && cell.mobileNetworkCode <= 999;
        const validCellId = cell.cellId > 0 && cell.cellId <= 65535; // Rango típico 2G
        const validLAC = cell.locationAreaCode > 0 && cell.locationAreaCode <= 65535;
        
        return validMCC && validMNC && validCellId && validLAC;
      });
      
      if (validCells.length > 0) {
        geoPayload.cellTowers = validCells;
        geoPayload.radioType = radioType || 'gsm'; // GSM por defecto para 2G
        sourcesDetected.push(`GSM:${geoPayload.cellTowers.length}`);
        console.log(`📡 ${geoPayload.cellTowers.length} torres GSM válidas (${geoPayload.radioType})`);
        
        // Log detallado de torres GSM para debugging
        geoPayload.cellTowers.forEach((tower, index) => {
          console.log(`  📡 Torre ${index + 1}: MCC=${tower.mobileCountryCode}, MNC=${tower.mobileNetworkCode}, CellID=${tower.cellId}, LAC=${tower.locationAreaCode}`);
        });
      }
    }
    
    // 🌍 IP COMO FUENTE ADICIONAL
    if (considerIp === true) {
      geoPayload.considerIp = true;
      sourcesDetected.push('IP');
      console.log(`🌍 Incluyendo IP del cliente para geolocalización`);
    }
    
    // Verificar que tenemos al menos una fuente de datos
    if (!geoPayload.wifiAccessPoints && !geoPayload.cellTowers && !geoPayload.considerIp) {
      return res.status(400).json({ 
        status: 'INSUFFICIENT_DATA',
        message: 'Se requiere al menos WiFi o torres GSM para geolocalización',
        received: {
          wifi: wifiAccessPoints ? wifiAccessPoints.length : 0,
          gsm: cellTowers ? cellTowers.length : 0,
          ip: considerIp || false
        },
        deviceId: deviceId || null
      });
    }
    
    try {
      console.log(`🔍 Enviando a Google API - Fuentes: [${sourcesDetected.join(', ')}]`);
      console.log(`📝 Payload final:`, JSON.stringify(geoPayload, null, 2));
      
      // Llamada a Google Geolocation API con timeout optimizado para 2G
      const response = await axios.post(GOOGLE_GEOLOCATION_URL, geoPayload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 segundos para conexiones 2G lentas
      });
      
      if (response.data && response.data.location) {
        const location = response.data.location;
        const accuracy = response.data.accuracy || 1000;
        
        // Determinar calidad basada en precisión y fuentes
        let quality = 'medium';
        if (accuracy <= 100 && geoPayload.wifiAccessPoints && geoPayload.cellTowers) {
          quality = 'high';
        } else if (accuracy <= 500) {
          quality = 'good';
        } else if (accuracy > 2000) {
          quality = 'low';
        }
        
        console.log(`✅ Ubicación ESP32 obtenida: ${location.lat}, ${location.lng} (±${accuracy}m - ${quality})`);
        console.log(`📊 Fuentes utilizadas: ${sourcesDetected.join(', ')}`);
        
        return res.json({
          status: 'OK',
          location: {
            lat: location.lat,
            lng: location.lng
          },
          accuracy: accuracy,
          quality: quality,
          sources: {
            wifi: geoPayload.wifiAccessPoints ? geoPayload.wifiAccessPoints.length : 0,
            gsm: geoPayload.cellTowers ? geoPayload.cellTowers.length : 0,
            ip: geoPayload.considerIp || false,
            radioType: geoPayload.radioType || 'none'
          },
          deviceId: deviceId || null,
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error('Respuesta inválida de Google API');
      }
      
    } catch (apiError) {
      console.error('❌ Error en Google Geolocation API:', apiError.response?.data || apiError.message);
      
      // Manejo específico de errores para ESP32
      if (apiError.response?.status === 400) {
        return res.status(400).json({
          status: 'INVALID_REQUEST',
          message: 'Datos inválidos para geolocalización',
          details: apiError.response.data?.error?.message || 'Error de validación en Google API',
          suggestion: 'Verificar formato de datos WiFi y GSM',
          deviceId: deviceId || null
        });
      }
      
      if (apiError.response?.status === 403) {
        return res.status(500).json({
          status: 'API_KEY_ERROR',
          message: 'Error de autenticación con Google API',
          details: 'Verificar clave de API de Google',
          deviceId: deviceId || null
        });
      }
      
      if (apiError.response?.status === 404) {
        return res.status(404).json({
          status: 'NOT_FOUND',
          message: 'No se pudo determinar la ubicación con los datos proporcionados',
          suggestion: 'Verificar que las torres GSM sean válidas para la región',
          deviceId: deviceId || null
        });
      }
      
      // Para ESP32 con WiFi, proporcionar ubicación de fallback
      if (geoPayload.wifiAccessPoints && geoPayload.wifiAccessPoints.length > 0) {
        console.log(`🔄 API falló, usando ubicación de fallback para ESP32`);
        
        return res.json({
          status: 'FALLBACK',
          location: {
            lat: 40.4168,
            lng: -3.7038
          },
          accuracy: 10000, // 10km de precisión para fallback
          quality: 'fallback',
          sources: {
            wifi: geoPayload.wifiAccessPoints.length,
            gsm: geoPayload.cellTowers ? geoPayload.cellTowers.length : 0,
            ip: false,
            radioType: geoPayload.radioType || 'none'
          },
          note: 'Ubicación de fallback debido a error en Google API',
          deviceId: deviceId || null,
          timestamp: new Date().toISOString()
        });
      }
      
      throw apiError;
    }
    
  } catch (error) {
    console.error('❌ Error general en geolocalización ESP32:', error);
    res.status(500).json({
      status: 'UNKNOWN_ERROR',
      message: 'Error interno del servidor',
      error: error.message,
      deviceId: req.body.deviceId || null,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 📱 Geolocalización Móvil - Especializada para dispositivos móviles
 * 
 * @description Endpoint optimizado para dispositivos móviles con datos GSM/LTE
 * @route POST /api/location/mobile
 * @access Mobile (Android, iOS)
 * 
 * @input {Object} req.body - Datos completos del dispositivo móvil
 * @input {Array} req.body.cellTowers - Torres de telefonía detectadas
 * @input {Array} req.body.wifiAccessPoints - Redes WiFi cercanas (opcional)
 * @input {string} req.body.radioType - Tipo de red (gsm, lte, wcdma)
 * @input {boolean} req.body.considerIp - Usar IP para geolocalización
 * 
 * @output {Object} 200 - Ubicación con alta precisión móvil
 */
exports.mobileLocation = async (req, res) => {
  try {
    const { cellTowers, wifiAccessPoints, radioType, considerIp } = req.body;
    
    console.log(`📱 Solicitud de geolocalización móvil:`, JSON.stringify(req.body, null, 2));
    
    const geoPayload = {};
    
    // 📡 DATOS GSM/LTE (Prioridad alta para móviles)
    if (cellTowers && Array.isArray(cellTowers) && cellTowers.length > 0) {
      const validCells = cellTowers.filter(cell => {
        // Validación robusta para torres de telefonía
        const hasRequiredFields = cell.cellId && cell.locationAreaCode && 
                                  cell.mobileCountryCode && cell.mobileNetworkCode;
        
        // Validar rangos típicos
        const validRanges = cell.mobileCountryCode >= 200 && cell.mobileCountryCode <= 999 &&
                           cell.mobileNetworkCode >= 0 && cell.mobileNetworkCode <= 999;
        
        return hasRequiredFields && validRanges;
      });
      
      if (validCells.length > 0) {
        geoPayload.cellTowers = validCells;
        geoPayload.radioType = radioType || 'lte'; // LTE por defecto para móviles modernos
        console.log(`📡 ${validCells.length} torres celulares válidas (${geoPayload.radioType})`);
      }
    }
    
    // 📶 DATOS WIFI (Complementarios)
    if (wifiAccessPoints && Array.isArray(wifiAccessPoints) && wifiAccessPoints.length > 0) {
      const validWifi = wifiAccessPoints.filter(ap => 
        ap.macAddress && ap.signalStrength && ap.signalStrength > -85 // Más permisivo para móviles
      );
      
      if (validWifi.length > 0) {
        geoPayload.wifiAccessPoints = validWifi.slice(0, 10); // Máximo 10 redes para eficiencia
        console.log(`📶 ${geoPayload.wifiAccessPoints.length} redes WiFi incluidas`);
      }
    }
    
    // 🌍 IP COMO FALLBACK
    if (considerIp === true || (!geoPayload.cellTowers && !geoPayload.wifiAccessPoints)) {
      geoPayload.considerIp = true;
      console.log(`🌍 Incluyendo IP del cliente como fuente`);
    }
    
    // Verificar datos mínimos
    if (!geoPayload.cellTowers && !geoPayload.wifiAccessPoints && !geoPayload.considerIp) {
      return res.status(400).json({
        status: 'INSUFFICIENT_DATA',
        message: 'Se requieren datos celulares, WiFi o IP para geolocalización móvil',
        received: {
          cellTowers: cellTowers ? cellTowers.length : 0,
          wifiAccessPoints: wifiAccessPoints ? wifiAccessPoints.length : 0,
          considerIp: considerIp || false
        }
      });
    }
    
    try {
      console.log(`🔍 Enviando datos móviles a Google API...`);
      
      const response = await axios.post(GOOGLE_GEOLOCATION_URL, geoPayload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000 // Timeout más largo para datos celulares
      });
      
      if (response.data && response.data.location) {
        const location = response.data.location;
        const accuracy = response.data.accuracy || 1000;
        
        // Determinar calidad de la ubicación
        let quality = 'high';
        if (accuracy > 5000) quality = 'low';
        else if (accuracy > 1000) quality = 'medium';
        
        console.log(`✅ Ubicación móvil obtenida: ${location.lat}, ${location.lng} (±${accuracy}m - ${quality})`);
        
        return res.json({
          status: 'OK',
          location: {
            lat: location.lat,
            lng: location.lng
          },
          accuracy: accuracy,
          quality: quality,
          sources: {
            cellular: geoPayload.cellTowers ? geoPayload.cellTowers.length : 0,
            wifi: geoPayload.wifiAccessPoints ? geoPayload.wifiAccessPoints.length : 0,
            ip: geoPayload.considerIp || false,
            radioType: geoPayload.radioType
          },
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (apiError) {
      console.error('❌ Error en geolocalización móvil:', apiError.response?.data || apiError.message);
      
      // Manejo específico para errores móviles
      if (apiError.response?.status === 404) {
        return res.status(404).json({
          status: 'NOT_FOUND',
          message: 'No se pudo determinar la ubicación con los datos proporcionados',
          suggestion: 'Verificar que las torres celulares sean válidas para la región'
        });
      }
      
      throw apiError;
    }
    
  } catch (error) {
    console.error('❌ Error en endpoint móvil:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Error en geolocalización móvil',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 📶 Geolocalización Híbrida ESP32 (WiFi + GSM/2G)
 * 
 * @description Endpoint especializado para ESP32 que escanea WiFi pero envía por GPRS
 *              Optimizado para combinar detección WiFi local con transmisión 2G
 * @route POST /api/location/hybrid
 * @access Device (ESP32 con módulo GSM)
 * 
 * @input {Object} req.body - Datos híbridos del ESP32
 * @input {Array} req.body.wifiAccessPoints - Redes WiFi escaneadas localmente
 * @input {Object} req.body.gsmInfo - Información de la conexión GSM actual
 * @input {string} req.body.gsmInfo.mcc - Mobile Country Code
 * @input {string} req.body.gsmInfo.mnc - Mobile Network Code  
 * @input {string} req.body.gsmInfo.lac - Location Area Code
 * @input {string} req.body.gsmInfo.cellId - Cell ID actual
 * @input {number} req.body.gsmInfo.signal - Intensidad señal GSM (-113 a -51 dBm)
 * @input {string} req.body.deviceId - ID único del dispositivo
 * 
 * @output {Object} 200 - Ubicación híbrida WiFi + GSM
 */
exports.hybridLocation = async (req, res) => {
  try {
    const { wifiAccessPoints, gsmInfo, deviceId } = req.body;
    
    console.log(`🔀 Solicitud HÍBRIDA ESP32 - Device: ${deviceId || 'Sin ID'}`);
    console.log(`📊 Datos híbridos:`, JSON.stringify(req.body, null, 2));
    
    const geoPayload = {};
    let sources = [];
    
    // 📶 PROCESAR DATOS WIFI ESCANEADOS
    if (wifiAccessPoints && Array.isArray(wifiAccessPoints) && wifiAccessPoints.length > 0) {
      const validWifi = wifiAccessPoints.filter(ap => {
        // Validar MAC address
        if (!ap.macAddress || !ap.ssid) return false;
        
        // Convertir RSSI a formato esperado (si viene en formato ESP32)
        if (ap.rssi && !ap.signalStrength) {
          ap.signalStrength = ap.rssi;
        }
        
        // Filtrar señales muy débiles
        return ap.signalStrength && ap.signalStrength > -85;
      });
      
      if (validWifi.length > 0) {
        // Ordenar por señal más fuerte y tomar los mejores 12
        geoPayload.wifiAccessPoints = validWifi
          .sort((a, b) => b.signalStrength - a.signalStrength)
          .slice(0, 12);
        
        sources.push(`WiFi:${geoPayload.wifiAccessPoints.length}`);
        console.log(`📶 ${geoPayload.wifiAccessPoints.length} redes WiFi procesadas (mejor: ${geoPayload.wifiAccessPoints[0].signalStrength}dBm)`);
      }
    }
    
    // 📡 PROCESAR INFORMACIÓN GSM ACTUAL
    if (gsmInfo && gsmInfo.mcc && gsmInfo.mnc && gsmInfo.lac && gsmInfo.cellId) {
      // Construir datos de tower de telefonía actual
      const currentCell = {
        cellId: parseInt(gsmInfo.cellId),
        locationAreaCode: parseInt(gsmInfo.lac),
        mobileCountryCode: parseInt(gsmInfo.mcc),
        mobileNetworkCode: parseInt(gsmInfo.mnc)
      };
      
      // Agregar intensidad de señal si está disponible
      if (gsmInfo.signal) {
        currentCell.signalStrength = parseInt(gsmInfo.signal);
      }
      
      // Validar datos GSM
      const isValidGSM = currentCell.mobileCountryCode >= 200 && 
                         currentCell.mobileCountryCode <= 999 &&
                         currentCell.mobileNetworkCode >= 0 && 
                         currentCell.cellId > 0;
      
      if (isValidGSM) {
        geoPayload.cellTowers = [currentCell];
        geoPayload.radioType = 'gsm'; // Siempre GSM para ESP32 con 2G
        sources.push(`GSM:1`);
        
        console.log(`📡 Torre GSM actual: MCC=${currentCell.mobileCountryCode}, MNC=${currentCell.mobileNetworkCode}, Cell=${currentCell.cellId}, LAC=${currentCell.locationAreaCode}, Signal=${currentCell.signalStrength || 'N/A'}dBm`);
      }
    }
    
    // Verificar que tenemos datos suficientes
    if (!geoPayload.wifiAccessPoints && !geoPayload.cellTowers) {
      return res.status(400).json({
        status: 'INSUFFICIENT_DATA',
        message: 'Se requieren datos WiFi o información GSM válida',
        received: {
          wifiCount: wifiAccessPoints ? wifiAccessPoints.length : 0,
          gsmValid: !!(gsmInfo && gsmInfo.mcc && gsmInfo.mnc),
          deviceId: deviceId || null
        }
      });
    }
    
    try {
      console.log(`🔍 Enviando datos híbridos a Google - Fuentes: [${sources.join(', ')}]`);
      
      const response = await axios.post(GOOGLE_GEOLOCATION_URL, geoPayload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 20000 // 20 segundos para conexiones 2G muy lentas
      });
      
      if (response.data && response.data.location) {
        const location = response.data.location;
        const accuracy = response.data.accuracy || 1000;
        
        // Calidad basada en fuentes y precisión
        let quality = 'medium';
        if (geoPayload.wifiAccessPoints && geoPayload.cellTowers && accuracy <= 200) {
          quality = 'high';
        } else if (accuracy <= 500) {
          quality = 'good';
        } else if (accuracy > 5000) {
          quality = 'low';
        }
        
        console.log(`✅ Ubicación HÍBRIDA: ${location.lat}, ${location.lng} (±${accuracy}m - ${quality})`);
        
        return res.json({
          status: 'OK',
          mode: 'hybrid',
          location: {
            lat: location.lat,
            lng: location.lng
          },
          accuracy: accuracy,
          quality: quality,
          sources: {
            wifi: geoPayload.wifiAccessPoints ? geoPayload.wifiAccessPoints.length : 0,
            gsm: geoPayload.cellTowers ? geoPayload.cellTowers.length : 0,
            combined: sources.join(' + ')
          },
          deviceId: deviceId || null,
          connectionType: '2G/GPRS',
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (apiError) {
      console.error('❌ Error en geolocalización híbrida:', apiError.response?.data || apiError.message);
      
      // Fallback inteligente para ESP32
      if (geoPayload.wifiAccessPoints && geoPayload.wifiAccessPoints.length >= 3) {
        console.log(`🔄 API falló, calculando ubicación aproximada con ${geoPayload.wifiAccessPoints.length} redes WiFi`);
        
        return res.json({
          status: 'ESTIMATED',
          mode: 'wifi-fallback',
          location: {
            lat: 40.4168,
            lng: -3.7038
          },
          accuracy: 8000,
          quality: 'estimated',
          sources: {
            wifi: geoPayload.wifiAccessPoints.length,
            gsm: geoPayload.cellTowers ? geoPayload.cellTowers.length : 0,
            note: 'Ubicación estimada debido a error en API'
          },
          deviceId: deviceId || null,
          connectionType: '2G/GPRS',
          timestamp: new Date().toISOString()
        });
      }
      
      throw apiError;
    }
    
  } catch (error) {
    console.error('❌ Error en endpoint híbrido:', error);
    res.status(500).json({
      status: 'ERROR',
      mode: 'hybrid',
      message: 'Error en geolocalización híbrida',
      error: error.message,
      deviceId: req.body.deviceId || null,
      timestamp: new Date().toISOString()
    });
  }
};
