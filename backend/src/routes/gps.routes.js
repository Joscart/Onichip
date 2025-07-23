const express = require('express');
const router = express.Router();
const gpsController = require('../controllers/gps.controllers');

// 🗺️ RUTAS PARA GPS Y UBICACIÓN

// ESP32 endpoints
router.put('/device/:deviceId/location', gpsController.receiveLocation);
router.post('/location/wifi', gpsController.getWifiLocation);

// API endpoints para frontend
router.get('/mascota/:mascotaId/locations', gpsController.getMascotaLocations);

module.exports = router;
