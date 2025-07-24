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

// 📊 Reportes Excel - OPTIMIZADO
router.get('/reportes/excel', adminController.generateExcelReport);
router.get('/generate-excel', adminController.generateExcelReport); // Alias para compatibilidad

// 📋 NUEVAS RUTAS PARA REPORTES AVANZADOS
router.get('/dashboard-stats', adminController.dashboardStats);
router.post('/generate-report', adminController.generateReport);
router.post('/export-pdf', adminController.exportPDF);

// 📄 Reportes - OPTIMIZADO
router.get('/reportes/excel', adminController.generateExcelReport);

// ================================================
// 📊 NUEVAS RUTAS - REPORTES Y DASHBOARD AVANZADO
// ================================================

// 📈 Dashboard avanzado con estadísticas para gráficos
router.get('/dashboard-stats', adminController.dashboardStats);

// 📋 Generación de reportes exportables
router.post('/generate-report', adminController.generateReport);

// 📄 Exportación de reportes
router.post('/export-pdf', adminController.exportPDF);

module.exports = router;