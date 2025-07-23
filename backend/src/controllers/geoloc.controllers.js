const axios = require('axios');

// POST /api/geoloc/wifi
// Recibe un array de redes WiFi y retorna lat/lon usando Mozilla Location Service
// Espera: { wifiAccessPoints: [ { macAddress, signalStrength }, ... ] }
exports.geolocByWifi = async (req, res) => {
  const { wifiAccessPoints } = req.body;
  if (!wifiAccessPoints || !Array.isArray(wifiAccessPoints) || wifiAccessPoints.length === 0) {
    return res.status(400).json({ message: 'No se recibieron redes WiFi' });
  }
  try {
    const response = await axios.post('https://location.services.mozilla.com/v1/geolocate?key=test', {
      wifiAccessPoints
    });
    if (response.data && response.data.location) {
      return res.json({ lat: response.data.location.lat, lon: response.data.location.lng, accuracy: response.data.accuracy });
    } else {
      return res.status(500).json({ message: 'No se pudo obtener ubicación' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error en geolocalización', error: err.message });
  }
};
