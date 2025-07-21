const express = require('express');
const router = express.Router();

const deviceController = require('../controllers/mascotas.controllers');

// Devices CRUD
router.get('/device', deviceController.getMascotas); // get all devices
router.get('/device/:id', deviceController.getMascota); // get device by id
router.get('/device/owner/:ownerId', deviceController.getMascotasByOwner); // get devices by owner
router.post('/device', deviceController.addMascota); // create device
router.put('/device/dev/:deviceId', deviceController.editMascota); // update device by deviceId
router.delete('/device/:id', deviceController.deleteMascota); // delete device by id

// Ruta de prueba
router.get('/', (req, res) => {
  res.send('Bienvenido al rastreo de dispositivos y signos vitales');
});

module.exports = router;
