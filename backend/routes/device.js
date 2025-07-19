const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');


router.get('/', deviceController.getAll);
router.post('/', deviceController.create);
router.get('/:_id', deviceController.getById);
router.put('/:_id', deviceController.update);
router.delete('/:_id', deviceController.delete);

// CRUD by deviceId under /dev/:deviceId
router.get('/dev/:deviceId', deviceController.getByDeviceId);
router.put('/dev/:deviceId', deviceController.updateByDeviceId);
router.delete('/dev/:deviceId', deviceController.deleteByDeviceId);

module.exports = router;
