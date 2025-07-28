const express = require('express');
const router = express.Router();
const geolocController = require('../controllers/geoloc.controllers');

// POST /api/device/geoloc/wifi - Geolocalización WiFi (Web)
router.post('/device/geoloc/wifi', geolocController.geolocByWifi);

// POST /api/location/wifi - Geolocalización avanzada WiFi + GSM + IP
router.post('/location/wifi', geolocController.wifiLocation);

// POST /api/location/mobile - Geolocalización especializada para móviles
router.post('/location/mobile', geolocController.mobileLocation);

// POST /api/location/hybrid - Geolocalización híbrida ESP32 (WiFi scan + GSM transmit)
router.post('/location/hybrid', geolocController.hybridLocation);

module.exports = router;
