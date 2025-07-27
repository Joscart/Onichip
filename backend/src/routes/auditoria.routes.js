/**
 * ================================================
 * 🕵️ RUTAS DE AUDITORÍA - SISTEMA DE TRAZABILIDAD
 * ================================================
 * 
 * Rutas para la gestión y consulta de registros de auditoría
 * Incluye endpoints para consultas, estadísticas, seguridad y exportación
 * 
 * @author Onichip Team
 * @version 1.0
 */

const express = require('express');
const router = express.Router();
const auditoriaController = require('../controllers/auditoria.controllers');
const auditoriaMiddleware = require('../middlewares/auditoria');

// ================================
// 🔍 CONSULTAS DE AUDITORÍA
// ================================

/**
 * 📋 Obtener registros de auditoría con filtros
 * 
 * @route GET /api/admin/auditoria
 * @desc Obtiene registros de auditoría con paginación y filtros avanzados
 * @access Admin only
 * 
 * @query {number} page - Página (default: 1)
 * @query {number} limit - Límite por página (default: 20)
 * @query {string} accion - Filtrar por acción (CREATE, READ, UPDATE, DELETE, etc.)
 * @query {string} entidad - Filtrar por entidad (usuario, mascota, admin, etc.)
 * @query {string} actor - ID del actor que realizó la acción
 * @query {string} categoria - Filtrar por categoría (seguridad, operacion, etc.)
 * @query {string} severidad - Filtrar por severidad (info, warning, error, critical)
 * @query {string} fechaInicio - Fecha de inicio (ISO string)
 * @query {string} fechaFin - Fecha de fin (ISO string)
 * @query {string} buscar - Búsqueda de texto libre en resumen
 * 
 * @success {Object} 200 - Lista de registros de auditoría
 * @error {Object} 500 - Error interno del servidor
 * 
 * @example
 * GET /api/admin/auditoria?page=1&limit=20&accion=LOGIN&severidad=error&fechaInicio=2024-01-01
 */
router.get('/', auditoriaController.obtenerRegistros);

/**
 * 📊 Obtener estadísticas de auditoría
 * 
 * @route GET /api/admin/auditoria/estadisticas
 * @desc Genera estadísticas y métricas de los registros de auditoría
 * @access Admin only
 * 
 * @query {string} periodo - Período de análisis (7d, 30d, 90d, 1y) - default: 30d
 * 
 * @success {Object} 200 - Estadísticas completas de auditoría
 * @error {Object} 500 - Error interno del servidor
 * 
 * @example
 * GET /api/admin/auditoria/estadisticas?periodo=7d
 */
router.get('/estadisticas', auditoriaController.obtenerEstadisticas);

/**
 * 🚨 Obtener alertas de seguridad
 * 
 * @route GET /api/admin/auditoria/seguridad
 * @desc Obtiene operaciones críticas, intentos fallidos y alertas de seguridad
 * @access Admin only
 * 
 * @query {string} periodo - Período de análisis (24h, 7d, 30d) - default: 24h
 * 
 * @success {Object} 200 - Alertas y estadísticas de seguridad
 * @error {Object} 500 - Error interno del servidor
 * 
 * @example
 * GET /api/admin/auditoria/seguridad?periodo=7d
 */
router.get('/seguridad', auditoriaController.obtenerAlertasSeguridad);

/**
 * 🔍 Obtener historial de un actor específico
 * 
 * @route GET /api/admin/auditoria/actor/:id
 * @desc Obtiene el historial completo de operaciones de un usuario o admin
 * @access Admin only
 * 
 * @param {string} id - ID del actor (usuario o admin)
 * @query {number} limit - Límite de registros (default: 50)
 * 
 * @success {Object} 200 - Historial completo del actor
 * @error {Object} 404 - Actor no encontrado
 * @error {Object} 500 - Error interno del servidor
 * 
 * @example
 * GET /api/admin/auditoria/actor/507f1f77bcf86cd799439011?limit=100
 */
router.get('/actor/:id', auditoriaController.obtenerHistorialActor);

// ================================
// 📤 EXPORTACIÓN DE DATOS
// ================================

/**
 * 📤 Exportar registros de auditoría
 * 
 * @route GET /api/admin/auditoria/exportar
 * @desc Exporta registros de auditoría en formato Excel o CSV
 * @access Admin only
 * 
 * @query {string} formato - Formato de exportación (excel, csv) - default: excel
 * @query {string} fechaInicio - Fecha de inicio para filtrar registros
 * @query {string} fechaFin - Fecha de fin para filtrar registros
 * @query {string} filtros - Filtros adicionales en formato JSON string
 * 
 * @success {File} 200 - Archivo de exportación (Excel o CSV)
 * @error {Object} 400 - Parámetros inválidos
 * @error {Object} 500 - Error interno del servidor
 * 
 * @example
 * GET /api/admin/auditoria/exportar?formato=excel&fechaInicio=2024-01-01&fechaFin=2024-01-31
 */
router.get('/exportar', auditoriaController.exportarRegistros);

// ================================
// 🧹 MANTENIMIENTO
// ================================

/**
 * 🧹 Limpiar registros antiguos
 * 
 * @route DELETE /api/admin/auditoria/limpiar
 * @desc Elimina registros de auditoría antiguos según políticas de retención
 * @access Admin only
 * 
 * @body {number} diasAntiguedad - Días de antigüedad para eliminar (default: 90)
 * @body {string} severidadMinima - Severidad mínima a conservar (opcional)
 * 
 * @success {Object} 200 - Resultado de la operación de limpieza
 * @error {Object} 500 - Error interno del servidor
 * 
 * @example
 * DELETE /api/admin/auditoria/limpiar
 * Body: { "diasAntiguedad": 90, "severidadMinima": "warning" }
 */
router.delete('/limpiar', 
    auditoriaMiddleware.operacionCritica('auditoria', 'DELETE'),
    auditoriaController.limpiarRegistrosAntiguos
);

// ================================
// 🔧 RUTAS DE UTILIDAD
// ================================

/**
 * 📊 Obtener resumen rápido de auditoría
 * 
 * @route GET /api/admin/auditoria/resumen
 * @desc Obtiene un resumen rápido de la actividad reciente
 * @access Admin only
 * 
 * @success {Object} 200 - Resumen de actividad reciente
 * @error {Object} 500 - Error interno del servidor
 */
router.get('/resumen', async (req, res) => {
    try {
        const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const [totalUltimas24h, operacionesCriticas, loginsFallidos] = await Promise.all([
            require('../models/auditoria').countDocuments({
                timestamp: { $gte: hace24h }
            }),
            require('../models/auditoria').countDocuments({
                timestamp: { $gte: hace24h },
                severidad: 'critical'
            }),
            require('../models/auditoria').countDocuments({
                timestamp: { $gte: hace24h },
                accion: 'LOGIN',
                'metadata.exitoso': false
            })
        ]);
        
        res.json({
            resumen: {
                totalOperaciones24h: totalUltimas24h,
                operacionesCriticas24h: operacionesCriticas,
                loginsFallidos24h: loginsFallidos,
                estadoGeneral: operacionesCriticas > 5 ? 'crítico' : 
                              loginsFallidos > 10 ? 'alerta' : 'normal'
            },
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Error obteniendo resumen de auditoría:', error);
        res.status(500).json({ 
            message: 'Error al obtener resumen de auditoría',
            error: error.message 
        });
    }
});

/**
 * 🏷️ Obtener opciones de filtros disponibles
 * 
 * @route GET /api/admin/auditoria/filtros
 * @desc Obtiene las opciones disponibles para filtrar registros
 * @access Admin only
 * 
 * @success {Object} 200 - Opciones de filtros disponibles
 * @error {Object} 500 - Error interno del servidor
 */
router.get('/filtros', async (req, res) => {
    try {
        const Auditoria = require('../models/auditoria');
        
        const [acciones, entidades, categorias, severidades, tiposActor] = await Promise.all([
            Auditoria.distinct('accion'),
            Auditoria.distinct('entidad'),
            Auditoria.distinct('categoria'),
            Auditoria.distinct('severidad'),
            Auditoria.distinct('actor.tipo')
        ]);
        
        res.json({
            filtrosDisponibles: {
                acciones: acciones.sort(),
                entidades: entidades.sort(),
                categorias: categorias.sort(),
                severidades: ['info', 'warning', 'error', 'critical'],
                tiposActor: tiposActor.sort()
            },
            descripcionFiltros: {
                acciones: 'Tipo de operación realizada (CREATE, READ, UPDATE, DELETE, LOGIN, etc.)',
                entidades: 'Tipo de objeto afectado (usuario, mascota, admin, ubicacion, etc.)',
                categorias: 'Categoría de la operación (seguridad, operacion, reporte, etc.)',
                severidades: 'Nivel de importancia de la operación',
                tiposActor: 'Tipo de usuario que realizó la operación (admin, usuario, sistema)'
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo filtros de auditoría:', error);
        res.status(500).json({ 
            message: 'Error al obtener filtros de auditoría',
            error: error.message 
        });
    }
});

// ================================
// 🔒 MIDDLEWARE DE AUDITORÍA
// ================================

// Aplicar middleware de auditoría a todas las rutas de este router
// (esto capturará automáticamente todas las consultas a auditoría)
router.use(auditoriaMiddleware.capturarOperacion);

module.exports = router;
