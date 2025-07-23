const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controllers');

// 🔐 Autenticación
router.post('/login', adminController.loginAdmin);

// 📊 Dashboard - OPTIMIZADO
router.get('/dashboard', adminController.getDashboardStats);
router.get('/dashboard-charts', adminController.getDashboardCharts); // Nueva ruta optimizada
router.get('/estadisticas-generales', adminController.getEstadisticasGenerales); // Nueva ruta optimizada
router.get('/estadisticas-gps', adminController.estadisticasGPS); // Estadísticas GPS para admin
router.get('/alertas', adminController.getAlertas);
router.get('/reportes', adminController.getReportes);

// 👥 Gestión de usuarios
router.get('/usuarios', adminController.getAllUsuarios);
router.post('/usuarios', adminController.createUsuario);
router.put('/usuarios/:id', adminController.updateUsuario);
router.delete('/usuarios/:id', adminController.deleteUsuario);

// 🐕 Gestión de mascotas
router.get('/mascotas', adminController.getAllMascotas);
router.put('/mascotas/:id', adminController.updateMascota);
router.delete('/mascotas/:id', adminController.deleteMascota);

// 📱 Datos IoT - OPTIMIZADO
router.get('/datos-iot', adminController.getDatosIoT);
router.post('/datos-iot/generar-ejemplo', adminController.generateSampleIoTData);

// 📄 Reportes - OPTIMIZADO
router.get('/reportes/excel', adminController.generateExcelReport);

module.exports = router;