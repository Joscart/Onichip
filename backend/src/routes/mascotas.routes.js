const express = require('express');
const router = express.Router();

const mascotaController = require('../controllers/mascotas.controllers');

// Mascotas CRUD
router.get('/mascotas', mascotaController.getMascotas); // get all mascotas
router.get('/mascotas/:id', mascotaController.getMascota); // get mascota by id
router.get('/mascotas/owner/:ownerId', mascotaController.getMascotasByOwner); // get mascotas by owner
router.post('/mascotas', mascotaController.addMascota); // create mascota
router.put('/mascotas/dev/:deviceId', mascotaController.editMascota); // update mascota by deviceId
router.delete('/mascotas/:id', mascotaController.deleteMascota); // delete mascota by id

// Mantener compatibilidad con rutas anteriores (device)
router.get('/device', mascotaController.getMascotas); // get all devices
router.get('/device/:id', mascotaController.getMascota); // get device by id
router.get('/device/owner/:ownerId', mascotaController.getMascotasByOwner); // get devices by owner
router.post('/device', mascotaController.addMascota); // create device
router.put('/device/dev/:deviceId', mascotaController.editMascota); // update device by deviceId
router.delete('/device/:id', mascotaController.deleteMascota); // delete device by id

// Ruta de prueba
router.get('/', (req, res) => {
  res.send('Bienvenido al sistema de mascotas IoT Onichip');
});

module.exports = router;
