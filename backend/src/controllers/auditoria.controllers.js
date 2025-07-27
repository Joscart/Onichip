/**
 * ================================================
 * 🕵️ CONTROLADOR DE AUDITORÍA - GESTIÓN DE LOGS
 * ================================================
 * 
 * Controlador para consultar, analizar y gestionar los registros de auditoría
 * Incluye endpoints para reportes, estadísticas y análisis de seguridad
 * 
 * @author Onichip Team
 * @version 1.0
 */

const Auditoria = require('../models/auditoria');
const Usuario = require('../models/usuario');
const Admin = require('../models/admin');
const Mascota = require('../models/mascota');

const auditoriaController = {};

/**
 * 📋 Obtener registros de auditoría con filtros
 * 
 * @description Obtiene registros de auditoría con paginación y filtros avanzados
 * @route GET /api/admin/auditoria
 * @access Admin only
 * 
 * @input {Object} req.query - Filtros de búsqueda
 * @input {number} req.query.page - Página (default: 1)
 * @input {number} req.query.limit - Límite por página (default: 20)
 * @input {string} req.query.accion - Filtrar por acción (CREATE, READ, UPDATE, DELETE, etc.)
 * @input {string} req.query.entidad - Filtrar por entidad (usuario, mascota, admin, etc.)
 * @input {string} req.query.actor - ID del actor que realizó la acción
 * @input {string} req.query.categoria - Filtrar por categoría (seguridad, operacion, etc.)
 * @input {string} req.query.severidad - Filtrar por severidad (info, warning, error, critical)
 * @input {string} req.query.fechaInicio - Fecha de inicio (ISO string)
 * @input {string} req.query.fechaFin - Fecha de fin (ISO string)
 * @input {string} req.query.buscar - Búsqueda de texto libre en resumen
 * 
 * @output {Object} 200 - Lista de registros de auditoría
 * @output {Array} response.registros - Registros de auditoría
 * @output {number} response.total - Total de registros
 * @output {number} response.pagina - Página actual
 * @output {number} response.totalPaginas - Total de páginas
 * @output {Object} 500 - Error interno del servidor
 */
auditoriaController.obtenerRegistros = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            accion,
            entidad,
            actor,
            categoria,
            severidad,
            fechaInicio,
            fechaFin,
            buscar
        } = req.query;

        console.log('🔍 Consultando registros de auditoría:', req.query);

        // Construir filtros
        const filtros = {};

        if (accion) filtros.accion = accion;
        if (entidad) filtros.entidad = entidad;
        if (actor) filtros['actor.id'] = actor;
        if (categoria) filtros.categoria = categoria;
        if (severidad) filtros.severidad = severidad;

        // Filtro de fechas
        if (fechaInicio || fechaFin) {
            filtros.timestamp = {};
            if (fechaInicio) filtros.timestamp.$gte = new Date(fechaInicio);
            if (fechaFin) filtros.timestamp.$lte = new Date(fechaFin);
        }

        // Búsqueda de texto libre
        if (buscar && buscar.trim()) {
            filtros.$or = [
                { resumen: { $regex: buscar, $options: 'i' } },
                { 'actor.email': { $regex: buscar, $options: 'i' } },
                { 'actor.nombre': { $regex: buscar, $options: 'i' } },
                { 'objetivo.nombre': { $regex: buscar, $options: 'i' } }
            ];
        }

        // Ejecutar consulta con paginación
        const [registros, total] = await Promise.all([
            Auditoria.find(filtros)
                .sort({ timestamp: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .lean(),
            Auditoria.countDocuments(filtros)
        ]);

        console.log(`✅ Encontrados ${registros.length} registros de ${total} totales`);

        res.json({
            registros,
            total,
            pagina: parseInt(page),
            totalPaginas: Math.ceil(total / limit),
            filtrosAplicados: filtros
        });

    } catch (error) {
        console.error('❌ Error obteniendo registros de auditoría:', error);
        res.status(500).json({ 
            message: 'Error al obtener registros de auditoría',
            error: error.message 
        });
    }
};

/**
 * 📊 Obtener estadísticas de auditoría
 * 
 * @description Genera estadísticas y métricas de los registros de auditoría
 * @route GET /api/admin/auditoria/estadisticas
 * @access Admin only
 * 
 * @input {Object} req.query - Filtros para las estadísticas
 * @input {string} req.query.periodo - Período de análisis (7d, 30d, 90d, 1y)
 * 
 * @output {Object} 200 - Estadísticas de auditoría
 * @output {Object} response.resumen - Resumen general
 * @output {Array} response.porAccion - Estadísticas por acción
 * @output {Array} response.porEntidad - Estadísticas por entidad
 * @output {Array} response.porActor - Estadísticas por tipo de actor
 * @output {Array} response.porSeveridad - Estadísticas por severidad
 * @output {Array} response.tendencia - Tendencia temporal
 * @output {Object} 500 - Error interno del servidor
 */
auditoriaController.obtenerEstadisticas = async (req, res) => {
    try {
        const { periodo = '30d' } = req.query;
        
        console.log('📊 Generando estadísticas de auditoría para período:', periodo);

        // Calcular fecha de inicio según el período
        const ahora = new Date();
        const fechaInicio = new Date();
        
        switch (periodo) {
            case '7d':
                fechaInicio.setDate(ahora.getDate() - 7);
                break;
            case '30d':
                fechaInicio.setDate(ahora.getDate() - 30);
                break;
            case '90d':
                fechaInicio.setDate(ahora.getDate() - 90);
                break;
            case '1y':
                fechaInicio.setFullYear(ahora.getFullYear() - 1);
                break;
            default:
                fechaInicio.setDate(ahora.getDate() - 30);
        }

        const filtroFecha = { timestamp: { $gte: fechaInicio, $lte: ahora } };

        // Ejecutar agregaciones en paralelo
        const [
            resumenGeneral,
            estadisticasPorAccion,
            estadisticasPorEntidad,
            estadisticasPorActor,
            estadisticasPorSeveridad,
            tendenciaTemporal,
            operacionesCriticas,
            actoresTopActividad
        ] = await Promise.all([
            // Resumen general
            Auditoria.aggregate([
                { $match: filtroFecha },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        exitosas: { $sum: { $cond: ['$metadata.exitoso', 1, 0] } },
                        fallidas: { $sum: { $cond: ['$metadata.exitoso', 0, 1] } },
                        criticas: { $sum: { $cond: [{ $eq: ['$severidad', 'critical'] }, 1, 0] } },
                        errores: { $sum: { $cond: [{ $eq: ['$severidad', 'error'] }, 1, 0] } },
                        tiempoPromedioEjecucion: { $avg: '$metadata.tiempoEjecucion' }
                    }
                }
            ]),

            // Por acción
            Auditoria.aggregate([
                { $match: filtroFecha },
                {
                    $group: {
                        _id: '$accion',
                        count: { $sum: 1 },
                        exitosas: { $sum: { $cond: ['$metadata.exitoso', 1, 0] } },
                        tiempoPromedio: { $avg: '$metadata.tiempoEjecucion' }
                    }
                },
                { $sort: { count: -1 } }
            ]),

            // Por entidad
            Auditoria.aggregate([
                { $match: filtroFecha },
                {
                    $group: {
                        _id: '$entidad',
                        count: { $sum: 1 },
                        ultimaActividad: { $max: '$timestamp' }
                    }
                },
                { $sort: { count: -1 } }
            ]),

            // Por tipo de actor
            Auditoria.aggregate([
                { $match: filtroFecha },
                {
                    $group: {
                        _id: '$actor.tipo',
                        count: { $sum: 1 },
                        actoresUnicos: { $addToSet: '$actor.id' }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        count: 1,
                        actoresUnicos: { $size: '$actoresUnicos' }
                    }
                }
            ]),

            // Por severidad
            Auditoria.aggregate([
                { $match: filtroFecha },
                {
                    $group: {
                        _id: '$severidad',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ]),

            // Tendencia temporal (por día)
            Auditoria.aggregate([
                { $match: filtroFecha },
                {
                    $group: {
                        _id: {
                            fecha: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
                        },
                        total: { $sum: 1 },
                        exitosas: { $sum: { $cond: ['$metadata.exitoso', 1, 0] } },
                        errores: { $sum: { $cond: [{ $eq: ['$severidad', 'error'] }, 1, 0] } }
                    }
                },
                { $sort: { '_id.fecha': 1 } }
            ]),

            // Operaciones críticas recientes
            Auditoria.find({
                ...filtroFecha,
                severidad: { $in: ['critical', 'error'] }
            })
                .sort({ timestamp: -1 })
                .limit(10)
                .select('timestamp accion entidad actor.email resumen severidad')
                .lean(),

            // Top actores por actividad
            Auditoria.aggregate([
                { $match: filtroFecha },
                {
                    $group: {
                        _id: {
                            id: '$actor.id',
                            email: '$actor.email',
                            nombre: '$actor.nombre',
                            tipo: '$actor.tipo'
                        },
                        totalOperaciones: { $sum: 1 },
                        ultimaActividad: { $max: '$timestamp' },
                        operacionesExitosas: { $sum: { $cond: ['$metadata.exitoso', 1, 0] } }
                    }
                },
                { $sort: { totalOperaciones: -1 } },
                { $limit: 10 }
            ])
        ]);

        const estadisticas = {
            resumen: resumenGeneral[0] || {
                total: 0,
                exitosas: 0,
                fallidas: 0,
                criticas: 0,
                errores: 0,
                tiempoPromedioEjecucion: 0
            },
            porAccion: estadisticasPorAccion,
            porEntidad: estadisticasPorEntidad,
            porActor: estadisticasPorActor,
            porSeveridad: estadisticasPorSeveridad,
            tendencia: tendenciaTemporal,
            operacionesCriticas,
            actoresTopActividad,
            periodo,
            generado: new Date()
        };

        console.log('✅ Estadísticas generadas exitosamente');
        res.json(estadisticas);

    } catch (error) {
        console.error('❌ Error generando estadísticas de auditoría:', error);
        res.status(500).json({ 
            message: 'Error al generar estadísticas de auditoría',
            error: error.message 
        });
    }
};

/**
 * 🔍 Buscar registros por actor específico
 * 
 * @description Obtiene el historial de operaciones de un usuario o admin específico
 * @route GET /api/admin/auditoria/actor/:id
 * @access Admin only
 * 
 * @input {string} req.params.id - ID del actor
 * @input {Object} req.query - Filtros adicionales
 * @input {number} req.query.limit - Límite de registros (default: 50)
 * 
 * @output {Object} 200 - Historial del actor
 * @output {Object} response.actor - Información del actor
 * @output {Array} response.registros - Registros de operaciones
 * @output {Object} response.resumen - Resumen de actividad
 * @output {Object} 404 - Actor no encontrado
 * @output {Object} 500 - Error interno del servidor
 */
auditoriaController.obtenerHistorialActor = async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50 } = req.query;

        console.log('🔍 Consultando historial del actor:', id);

        // Buscar registros del actor
        const registros = await Auditoria.find({ 'actor.id': id })
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .lean();

        if (registros.length === 0) {
            return res.status(404).json({ 
                message: 'No se encontraron registros para este actor' 
            });
        }

        // Obtener información del actor desde el primer registro
        const actorInfo = registros[0].actor;

        // Generar resumen de actividad
        const resumen = registros.reduce((acc, registro) => {
            acc.totalOperaciones++;
            
            if (registro.metadata.exitoso) {
                acc.operacionesExitosas++;
            } else {
                acc.operacionesFallidas++;
            }
            
            acc.operacionesPorAccion[registro.accion] = 
                (acc.operacionesPorAccion[registro.accion] || 0) + 1;
            
            acc.operacionesPorEntidad[registro.entidad] = 
                (acc.operacionesPorEntidad[registro.entidad] || 0) + 1;
            
            return acc;
        }, {
            totalOperaciones: 0,
            operacionesExitosas: 0,
            operacionesFallidas: 0,
            operacionesPorAccion: {},
            operacionesPorEntidad: {},
            primeraActividad: registros[registros.length - 1]?.timestamp,
            ultimaActividad: registros[0]?.timestamp
        });

        res.json({
            actor: actorInfo,
            registros,
            resumen,
            totalRegistros: registros.length
        });

    } catch (error) {
        console.error('❌ Error obteniendo historial del actor:', error);
        res.status(500).json({ 
            message: 'Error al obtener historial del actor',
            error: error.message 
        });
    }
};

/**
 * 🚨 Obtener operaciones críticas y alertas de seguridad
 * 
 * @description Obtiene operaciones críticas, intentos de acceso fallidos y alertas de seguridad
 * @route GET /api/admin/auditoria/seguridad
 * @access Admin only
 * 
 * @input {Object} req.query - Filtros de búsqueda
 * @input {string} req.query.periodo - Período de análisis (24h, 7d, 30d)
 * 
 * @output {Object} 200 - Alertas de seguridad
 * @output {Array} response.operacionesCriticas - Operaciones críticas recientes
 * @output {Array} response.intentosFallidos - Intentos de login fallidos
 * @output {Array} response.operacionesSospechosas - Operaciones potencialmente sospechosas
 * @output {Object} response.estadisticas - Estadísticas de seguridad
 * @output {Object} 500 - Error interno del servidor
 */
auditoriaController.obtenerAlertasSeguridad = async (req, res) => {
    try {
        const { periodo = '24h' } = req.query;

        console.log('🚨 Generando reporte de seguridad para período:', periodo);

        // Calcular fecha de inicio
        const ahora = new Date();
        const fechaInicio = new Date();
        
        switch (periodo) {
            case '24h':
                fechaInicio.setHours(ahora.getHours() - 24);
                break;
            case '7d':
                fechaInicio.setDate(ahora.getDate() - 7);
                break;
            case '30d':
                fechaInicio.setDate(ahora.getDate() - 30);
                break;
            default:
                fechaInicio.setHours(ahora.getHours() - 24);
        }

        const filtroFecha = { timestamp: { $gte: fechaInicio, $lte: ahora } };

        // Ejecutar consultas en paralelo
        const [
            operacionesCriticas,
            intentosFallidos,
            operacionesSospechosas,
            estadisticasSeguridad
        ] = await Promise.all([
            // Operaciones críticas
            Auditoria.find({
                ...filtroFecha,
                severidad: 'critical'
            })
                .sort({ timestamp: -1 })
                .limit(20)
                .lean(),

            // Intentos de login fallidos
            Auditoria.find({
                ...filtroFecha,
                accion: 'LOGIN',
                'metadata.exitoso': false
            })
                .sort({ timestamp: -1 })
                .limit(50)
                .lean(),

            // Operaciones sospechosas (múltiples acciones del mismo IP en corto tiempo)
            Auditoria.aggregate([
                { $match: filtroFecha },
                {
                    $group: {
                        _id: '$actor.ip',
                        count: { $sum: 1 },
                        actores: { $addToSet: '$actor.email' },
                        operaciones: { $push: { 
                            timestamp: '$timestamp',
                            accion: '$accion',
                            entidad: '$entidad',
                            actor: '$actor.email'
                        }},
                        primerOperacion: { $min: '$timestamp' },
                        ultimaOperacion: { $max: '$timestamp' }
                    }
                },
                {
                    $match: {
                        count: { $gt: 10 }, // Más de 10 operaciones
                        actores: { $size: { $gt: 1 } } // Múltiples actores desde la misma IP
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),

            // Estadísticas de seguridad
            Auditoria.aggregate([
                { $match: filtroFecha },
                {
                    $group: {
                        _id: null,
                        totalOperaciones: { $sum: 1 },
                        operacionesCriticas: { 
                            $sum: { $cond: [{ $eq: ['$severidad', 'critical'] }, 1, 0] }
                        },
                        operacionesError: { 
                            $sum: { $cond: [{ $eq: ['$severidad', 'error'] }, 1, 0] }
                        },
                        loginsFallidos: { 
                            $sum: { 
                                $cond: [
                                    { 
                                        $and: [
                                            { $eq: ['$accion', 'LOGIN'] },
                                            { $eq: ['$metadata.exitoso', false] }
                                        ]
                                    }, 
                                    1, 
                                    0
                                ]
                            }
                        },
                        ipsUnicas: { $addToSet: '$actor.ip' },
                        actoresUnicos: { $addToSet: '$actor.id' }
                    }
                },
                {
                    $project: {
                        totalOperaciones: 1,
                        operacionesCriticas: 1,
                        operacionesError: 1,
                        loginsFallidos: 1,
                        ipsUnicas: { $size: '$ipsUnicas' },
                        actoresUnicos: { $size: '$actoresUnicos' }
                    }
                }
            ])
        ]);

        const alertas = {
            operacionesCriticas,
            intentosFallidos,
            operacionesSospechosas,
            estadisticas: estadisticasSeguridad[0] || {
                totalOperaciones: 0,
                operacionesCriticas: 0,
                operacionesError: 0,
                loginsFallidos: 0,
                ipsUnicas: 0,
                actoresUnicos: 0
            },
            periodo,
            generado: new Date()
        };

        console.log('✅ Reporte de seguridad generado exitosamente');
        res.json(alertas);

    } catch (error) {
        console.error('❌ Error generando reporte de seguridad:', error);
        res.status(500).json({ 
            message: 'Error al generar reporte de seguridad',
            error: error.message 
        });
    }
};

/**
 * 📤 Exportar registros de auditoría
 * 
 * @description Exporta registros de auditoría en formato Excel o CSV
 * @route GET /api/admin/auditoria/exportar
 * @access Admin only
 * 
 * @input {Object} req.query - Parámetros de exportación
 * @input {string} req.query.formato - Formato de exportación (excel, csv)
 * @input {string} req.query.fechaInicio - Fecha de inicio
 * @input {string} req.query.fechaFin - Fecha de fin
 * @input {string} req.query.filtros - Filtros adicionales (JSON string)
 * 
 * @output {File} 200 - Archivo de exportación
 * @output {Object} 400 - Parámetros inválidos
 * @output {Object} 500 - Error interno del servidor
 */
auditoriaController.exportarRegistros = async (req, res) => {
    try {
        const { 
            formato = 'excel',
            fechaInicio,
            fechaFin,
            filtros: filtrosString
        } = req.query;

        console.log('📤 Exportando registros de auditoría en formato:', formato);

        // Construir filtros
        let filtros = {};
        if (filtrosString) {
            try {
                filtros = JSON.parse(filtrosString);
            } catch (e) {
                console.warn('Filtros inválidos, usando filtros por defecto');
            }
        }

        // Agregar filtro de fechas
        if (fechaInicio || fechaFin) {
            filtros.timestamp = {};
            if (fechaInicio) filtros.timestamp.$gte = new Date(fechaInicio);
            if (fechaFin) filtros.timestamp.$lte = new Date(fechaFin);
        }

        // Obtener registros (limitar a 10000 para evitar sobrecarga)
        const registros = await Auditoria.find(filtros)
            .sort({ timestamp: -1 })
            .limit(10000)
            .lean();

        if (formato === 'excel') {
            // Usar ExcelJS para generar Excel (reutilizar lógica de reportes)
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Auditoría');

            // Configurar columnas
            worksheet.columns = [
                { header: 'Fecha/Hora', key: 'timestamp', width: 20 },
                { header: 'Acción', key: 'accion', width: 15 },
                { header: 'Entidad', key: 'entidad', width: 15 },
                { header: 'Actor', key: 'actorEmail', width: 25 },
                { header: 'Tipo Actor', key: 'actorTipo', width: 12 },
                { header: 'Resumen', key: 'resumen', width: 50 },
                { header: 'Severidad', key: 'severidad', width: 12 },
                { header: 'Exitoso', key: 'exitoso', width: 10 },
                { header: 'IP', key: 'ip', width: 15 },
                { header: 'Endpoint', key: 'endpoint', width: 30 }
            ];

            // Agregar datos
            registros.forEach(registro => {
                worksheet.addRow({
                    timestamp: new Date(registro.timestamp).toLocaleString('es-ES'),
                    accion: registro.accion,
                    entidad: registro.entidad,
                    actorEmail: registro.actor.email,
                    actorTipo: registro.actor.tipo,
                    resumen: registro.resumen,
                    severidad: registro.severidad,
                    exitoso: registro.metadata.exitoso ? 'Sí' : 'No',
                    ip: registro.actor.ip,
                    endpoint: registro.metadata.endpoint || 'N/A'
                });
            });

            // Aplicar estilos al header
            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: '2E86AB' }
                };
            });

            // Configurar respuesta
            const fileName = `auditoria-onichip-${Date.now()}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

            await workbook.xlsx.write(res);
            console.log(`✅ Archivo Excel generado: ${fileName}`);

        } else {
            // Formato CSV
            const campos = [
                'timestamp', 'accion', 'entidad', 'actor.email', 'actor.tipo',
                'resumen', 'severidad', 'metadata.exitoso', 'actor.ip', 'metadata.endpoint'
            ];

            let csv = campos.join(',') + '\n';
            
            registros.forEach(registro => {
                const fila = campos.map(campo => {
                    let valor = '';
                    if (campo.includes('.')) {
                        const partes = campo.split('.');
                        valor = registro[partes[0]] && registro[partes[0]][partes[1]] || '';
                    } else {
                        valor = registro[campo] || '';
                    }
                    
                    // Escapar comillas y agregar comillas si contiene comas
                    if (typeof valor === 'string' && (valor.includes(',') || valor.includes('"'))) {
                        valor = `"${valor.replace(/"/g, '""')}"`;
                    }
                    
                    return valor;
                });
                
                csv += fila.join(',') + '\n';
            });

            const fileName = `auditoria-onichip-${Date.now()}.csv`;
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.send(csv);
            
            console.log(`✅ Archivo CSV generado: ${fileName}`);
        }

    } catch (error) {
        console.error('❌ Error exportando registros de auditoría:', error);
        res.status(500).json({ 
            message: 'Error al exportar registros de auditoría',
            error: error.message 
        });
    }
};

/**
 * 🧹 Limpiar registros antiguos
 * 
 * @description Limpia registros de auditoría antiguos según políticas de retención
 * @route DELETE /api/admin/auditoria/limpiar
 * @access Admin only
 * 
 * @input {Object} req.body - Parámetros de limpieza
 * @input {number} req.body.diasAntiguedad - Días de antigüedad para limpiar (default: 90)
 * @input {string} req.body.severidadMinima - Severidad mínima a conservar
 * 
 * @output {Object} 200 - Resultado de la limpieza
 * @output {number} response.eliminados - Registros eliminados
 * @output {Object} 500 - Error interno del servidor
 */
auditoriaController.limpiarRegistrosAntiguos = async (req, res) => {
    try {
        const { diasAntiguedad = 90, severidadMinima } = req.body;

        console.log(`🧹 Iniciando limpieza de registros antiguos (${diasAntiguedad} días)`);

        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - diasAntiguedad);

        let filtro = { timestamp: { $lt: fechaLimite } };

        // No eliminar registros críticos si se especifica severidad mínima
        if (severidadMinima) {
            const severidades = ['info', 'warning', 'error', 'critical'];
            const indiceSeveridad = severidades.indexOf(severidadMinima);
            
            if (indiceSeveridad > -1) {
                const severidadesAEliminar = severidades.slice(0, indiceSeveridad);
                filtro.severidad = { $in: severidadesAEliminar };
            }
        }

        const resultado = await Auditoria.deleteMany(filtro);

        console.log(`✅ Limpieza completada: ${resultado.deletedCount} registros eliminados`);

        res.json({
            mensaje: 'Limpieza completada exitosamente',
            eliminados: resultado.deletedCount,
            fechaLimite,
            filtroAplicado: filtro
        });

    } catch (error) {
        console.error('❌ Error en limpieza de registros:', error);
        res.status(500).json({ 
            message: 'Error en limpieza de registros',
            error: error.message 
        });
    }
};

module.exports = auditoriaController;
