const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Register and login
router.post('/register', userController.register);
router.post('/login', userController.login);


// Update user data
router.put('/:userId', userController.updateUser);

// Devices management for user
router.get('/:userId/devices', userController.getUserDevices);
router.post('/:userId/devices', userController.addDevice);
router.put('/:userId/devices/:deviceMongoId', userController.updateDeviceNickname);

module.exports = router;
