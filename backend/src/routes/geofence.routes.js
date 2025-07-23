const express = require('express');
const router = express.Router();
const geofenceController = require('../controllers/geofence.controllers');

// 🗺️ RUTAS PARA GEOFENCES

// CRUD de geofences
router.post('/', geofenceController.createGeofence);
router.get('/mascota/:mascotaId', geofenceController.getMascotaGeofences);
router.get('/usuario/:usuarioId', geofenceController.getUserGeofences);
router.put('/:geofenceId', geofenceController.updateGeofence);
router.delete('/:geofenceId', geofenceController.deleteGeofence);

// Estadísticas
router.get('/:geofenceId/stats', geofenceController.getGeofenceStats);

module.exports = router;
