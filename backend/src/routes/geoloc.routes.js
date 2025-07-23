const express = require('express');
const router = express.Router();
const geolocController = require('../controllers/geoloc.controllers');

// POST /api/device/geoloc/wifi
router.post('/device/geoloc/wifi', geolocController.geolocByWifi);

// POST /api/location/wifi - Endpoint específico para ESP32
router.post('/location/wifi', geolocController.wifiLocation);

module.exports = router;
