const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/device.controllers');

// 📱 Rutas para dispositivos ESP32
// PUT /api/dev/:deviceId - Actualizar datos del dispositivo (endpoint principal para ESP)
router.put('/dev/:deviceId', deviceController.updateDeviceData);

// GET /api/dev/:deviceId - Obtener estado del dispositivo
router.get('/dev/:deviceId', deviceController.getDeviceStatus);

// POST /api/dev/register - Registrar nuevo dispositivo
router.post('/dev/register', deviceController.registerDevice);

module.exports = router;
