const express = require('express');
const router = express.Router();
const geolocController = require('../controllers/geoloc.controllers');

// POST /api/device/geoloc/wifi
router.post('/device/geoloc/wifi', geolocController.geolocByWifi);

module.exports = router;
