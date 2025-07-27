/**
 * ================================================
 * 🛡️ MIDDLEWARE DE AUDITORÍA - SISTEMA DE TRAZABILIDAD
 * ================================================
 * 
 * Middleware para capturar automáticamente todas las operaciones del sistema
 * y registrarlas en la base de datos de auditoría
 * 
 * @author Onichip Team
 * @version 1.0
 */

const Auditoria = require('../models/auditoria');
const Usuario = require('../models/usuario');
const Admin = require('../models/admin');

/**
 * 🕵️ Middleware principal de auditoría
 * Captura automáticamente las solicitudes HTTP y genera registros de auditoría
 */
const auditoriaMiddleware = {
    
    /**
     * 📊 Middleware general para todas las rutas
     */
    capturarOperacion: async (req, res, next) => {
        console.log('🔍 AUDITORÍA: Capturando operación -', req.method, req.originalUrl);
        
        // Almacenar información de la solicitud para uso posterior
        req.auditoriaData = {
            timestamp: new Date(),
            metodo: req.method,
            endpoint: req.originalUrl,
            ip: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            headers: {
                'content-type': req.get('Content-Type'),
                'authorization': req.get('Authorization') ? '[PRESENTE]' : '[AUSENTE]'
            },
            query: req.query,
            // Solo capturar body si no contiene contraseñas
            body: auditoriaMiddleware.sanitizarBody(req.body),
            inicioTiempo: Date.now()
        };
        
        // Interceptar la respuesta para capturar el resultado
        const originalSend = res.send;
        res.send = function(data) {
            console.log('📤 AUDITORÍA: Respuesta interceptada -', res.statusCode, req.method, req.originalUrl);
            
            req.auditoriaData.tiempoEjecucion = Date.now() - req.auditoriaData.inicioTiempo;
            req.auditoriaData.codigoRespuesta = res.statusCode;
            req.auditoriaData.exitoso = res.statusCode < 400;
            
            // Procesar auditoría de forma asíncrona para no bloquear la respuesta
            setImmediate(() => {
                console.log('⚡ AUDITORÍA: Procesando auditoría de forma asíncrona...');
                auditoriaMiddleware.procesarAuditoria(req, res, data);
            });
            
            return originalSend.call(this, data);
        };
        
        next();
    },
    
    /**
     * 🧹 Sanitizar el body de la solicitud removiendo información sensible
     */
    sanitizarBody: (body) => {
        if (!body || typeof body !== 'object') return body;
        
        const bodyLimpio = { ...body };
        const camposSensibles = ['password', 'token', 'secret', 'key', 'auth'];
        
        camposSensibles.forEach(campo => {
            if (bodyLimpio[campo]) {
                bodyLimpio[campo] = '[OCULTADO]';
            }
        });
        
        return bodyLimpio;
    },
    
    /**
     * 🔍 Procesar y registrar la auditoría
     */
    procesarAuditoria: async (req, res, responseData) => {
        try {
            const { method, originalUrl } = req;
            const { auditoriaData } = req;
            
            console.log('🔍 Procesando auditoría para:', method, originalUrl);
            
            // Determinar si la operación requiere auditoría
            if (!auditoriaMiddleware.requiereAuditoria(originalUrl, method)) {
                console.log('⏭️ Operación no requiere auditoría:', originalUrl);
                return;
            }
            
            console.log('✅ Operación requiere auditoría');
            
            // Extraer información del actor (usuario/admin)
            const actor = await auditoriaMiddleware.extraerActor(req);
            console.log('👤 Actor extraído:', JSON.stringify(actor, null, 2));
            
            // Determinar acción y entidad
            const { accion, entidad } = auditoriaMiddleware.determinarAccionEntidad(originalUrl, method);
            console.log('🎯 Acción y entidad:', { accion, entidad });
            
            // Extraer información del objetivo
            const objetivo = await auditoriaMiddleware.extraerObjetivo(req, originalUrl, responseData);
            
            // Extraer cambios realizados
            const cambios = await auditoriaMiddleware.extraerCambios(req, responseData, accion);
            
            // Determinar categoría y severidad
            const { categoria, severidad } = auditoriaMiddleware.determinarCategoriaySeveridad(originalUrl, method, auditoriaData.codigoRespuesta);
            
            // Registrar en auditoría
            console.log('💾 Intentando registrar auditoría con datos:', {
                accion, entidad, actor: actor.nombre, objetivo: objetivo.nombre, categoria, severidad
            });
            
            await Auditoria.registrar({
                accion,
                entidad,
                actor,
                objetivo,
                cambios,
                metadata: {
                    metodo: auditoriaData.metodo,
                    endpoint: auditoriaData.endpoint,
                    headers: auditoriaData.headers,
                    query: auditoriaData.query,
                    body: auditoriaData.body,
                    tiempoEjecucion: auditoriaData.tiempoEjecucion,
                    exitoso: auditoriaData.exitoso,
                    codigoRespuesta: auditoriaData.codigoRespuesta,
                    version: '2.0',
                    modulo: auditoriaMiddleware.extraerModulo(originalUrl)
                },
                categoria,
                severidad
            });
            
            console.log('✅ Auditoría registrada exitosamente');
            
        } catch (error) {
            console.error('❌ Error en auditoría:', error);
            // No propagar el error para no afectar la funcionalidad principal
        }
    },
    
    /**
     * 🎯 Determinar si la operación requiere auditoría
     */
    requiereAuditoria: (url, method) => {
        // Excluir rutas que no requieren auditoría
        const rutasExcluidas = [
            '/health',
            '/favicon.ico',
            '/static',
            '/assets',
            '/api/ping'
        ];
        
        // Métodos que siempre se auditan
        const metodosAuditados = ['POST', 'PUT', 'DELETE', 'PATCH'];
        
        // URLs que siempre se auditan (incluso GET)
        const urlsSiempreAuditadas = [
            '/api/admin/login',
            '/api/auth/login',
            '/api/auth/logout',
            '/api/admin/reportes',
            '/api/admin/export',
            '/api/usuarios/ubicacion'
        ];
        
        return !rutasExcluidas.some(ruta => url.includes(ruta)) &&
               (metodosAuditados.includes(method) || 
                urlsSiempreAuditadas.some(ruta => url.includes(ruta)));
    },
    
    /**
     * 👤 Extraer información del actor (usuario/admin)
     */
    extraerActor: async (req) => {
        try {
            // Intentar extraer del token JWT en headers
            const authHeader = req.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                // Aquí podrías decodificar el JWT token si lo implementas
                // Por ahora, buscaremos en la sesión o cookies
            }
            
            // Buscar en diferentes fuentes de autenticación
            let userId = req.user?.id || req.session?.userId || req.body?.userId || req.query?.userId;
            let userType = req.user?.tipo || req.session?.userType || 'unknown';
            
            // Extraer del endpoint si es admin
            if (req.originalUrl.includes('/api/admin/')) {
                userType = 'admin';
                // Buscar admin por email si está en el body
                if (req.body?.email && req.body.email.includes('@onichip.com')) {
                    const admin = await Admin.findOne({ email: req.body.email });
                    if (admin) {
                        userId = admin._id;
                        return {
                            id: admin._id,
                            tipo: 'admin',
                            email: admin.email,
                            nombre: admin.nombre || 'Admin',
                            ip: req.auditoriaData.ip,
                            userAgent: req.auditoriaData.userAgent
                        };
                    }
                }
            }
            
            // Si no hay userId, intentar determinar del contexto
            if (!userId) {
                // Para operaciones de login, usar el email del body
                if (req.originalUrl.includes('/login') && req.body?.email) {
                    if (req.body.email.includes('@onichip.com')) {
                        const admin = await Admin.findOne({ email: req.body.email });
                        if (admin) {
                            return {
                                id: admin._id,
                                tipo: 'admin',
                                email: admin.email,
                                nombre: admin.nombre || 'Admin',
                                ip: req.auditoriaData.ip,
                                userAgent: req.auditoriaData.userAgent
                            };
                        }
                    } else {
                        const usuario = await Usuario.findOne({ email: req.body.email });
                        if (usuario) {
                            return {
                                id: usuario._id,
                                tipo: 'usuario',
                                email: usuario.email,
                                nombre: usuario.nombre || 'Usuario',
                                ip: req.auditoriaData.ip,
                                userAgent: req.auditoriaData.userAgent
                            };
                        }
                    }
                }
                
                // Actor del sistema para operaciones automáticas o públicas
                const mongoose = require('mongoose');
                return {
                    id: new mongoose.Types.ObjectId('000000000000000000000000'),
                    tipo: 'usuario',
                    email: 'publico@onichip.com',
                    nombre: 'Usuario Público',
                    ip: req.auditoriaData.ip,
                    userAgent: req.auditoriaData.userAgent
                };
            }
            
            // Buscar usuario o admin según el tipo
            let user = null;
            if (userType === 'admin') {
                user = await Admin.findById(userId);
            } else {
                user = await Usuario.findById(userId);
            }
            
            if (!user) {
                // Si no encontramos el usuario, usar actor anónimo
                const mongoose = require('mongoose');
                return {
                    id: new mongoose.Types.ObjectId('000000000000000000000000'),
                    tipo: 'usuario',
                    email: 'desconocido@onichip.com',
                    nombre: 'Usuario Desconocido',
                    ip: req.auditoriaData.ip,
                    userAgent: req.auditoriaData.userAgent
                };
            }
            
            return {
                id: user._id,
                tipo: userType,
                email: user.email,
                nombre: user.nombre || 'Usuario',
                ip: req.auditoriaData.ip,
                userAgent: req.auditoriaData.userAgent
            };
            
        } catch (error) {
            console.error('Error extrayendo actor:', error);
            // En caso de error, usar actor del sistema
            const mongoose = require('mongoose');
            return {
                id: new mongoose.Types.ObjectId('000000000000000000000000'),
                tipo: 'sistema',
                email: 'sistema@onichip.com',
                nombre: 'Sistema Onichip',
                ip: req.auditoriaData?.ip || 'unknown',
                userAgent: req.auditoriaData?.userAgent || 'unknown'
            };
        }
    },
    
    /**
     * 🎯 Determinar acción y entidad basado en la URL y método
     */
    determinarAccionEntidad: (url, method) => {
        const urlLower = url.toLowerCase();
        
        // Mapeo de rutas a entidades
        const entidadMap = {
            '/usuarios': 'usuario',
            '/mascotas': 'mascota',
            '/admin': 'admin',
            '/ubicacion': 'ubicacion',
            '/geofence': 'geofence',
            '/reportes': 'reporte',
            '/iot': 'datos_iot',
            '/recuperacion': 'recuperacion'
        };
        
        // Determinar entidad
        let entidad = 'sistema';
        for (const [ruta, ent] of Object.entries(entidadMap)) {
            if (urlLower.includes(ruta)) {
                entidad = ent;
                break;
            }
        }
        
        // Determinar acción
        let accion = 'READ';
        
        if (urlLower.includes('/login')) {
            accion = urlLower.includes('/logout') ? 'LOGOUT' : 'LOGIN';
        } else if (urlLower.includes('/report') || urlLower.includes('/export')) {
            accion = 'GENERATE_REPORT';
        } else if (urlLower.includes('/gps') || urlLower.includes('/ubicacion')) {
            accion = 'GPS_UPDATE';
        } else {
            // Mapeo estándar por método HTTP
            switch (method) {
                case 'POST':
                    accion = 'CREATE';
                    break;
                case 'PUT':
                case 'PATCH':
                    accion = 'UPDATE';
                    break;
                case 'DELETE':
                    accion = 'DELETE';
                    break;
                default:
                    accion = 'READ';
            }
        }
        
        return { accion, entidad };
    },
    
    /**
     * 🎯 Extraer información del objetivo de la operación
     */
    extraerObjetivo: async (req, url, responseData) => {
        const { params, body, query } = req;
        
        try {
            // Extraer ID del objetivo desde parámetros de ruta
            const id = params?.id || params?.userId || params?.mascotaId;
            
            let objetivo = {
                id: id || null,
                tipo: auditoriaMiddleware.determinarAccionEntidad(url, req.method).entidad,
                nombre: null,
                detalles: {}
            };
            
            // Información específica según el tipo de operación
            if (body) {
                objetivo.detalles = {
                    ...objetivo.detalles,
                    email: body.email,
                    telefono: body.telefono,
                    especie: body.especie,
                    raza: body.raza,
                    latitud: body.latitude || body.latitud,
                    longitud: body.longitude || body.longitud,
                    precision: body.accuracy || body.precision,
                    tipoReporte: body.tipoReporte || query.tipo,
                    parametros: { ...query, ...body }
                };
                
                objetivo.nombre = body.nombre || body.email || body.tipo || 'Objeto';
            }
            
            return objetivo;
            
        } catch (error) {
            console.error('Error extrayendo objetivo:', error);
            return { id: null, tipo: 'desconocido', nombre: null, detalles: {} };
        }
    },
    
    /**
     * 📝 Extraer cambios realizados en la operación
     */
    extraerCambios: async (req, responseData, accion) => {
        const cambios = {
            anterior: null,
            nuevo: null,
            camposModificados: []
        };
        
        try {
            if (accion === 'CREATE' && req.body) {
                cambios.nuevo = auditoriaMiddleware.sanitizarBody(req.body);
            } else if (accion === 'UPDATE' && req.body) {
                cambios.nuevo = auditoriaMiddleware.sanitizarBody(req.body);
                // TODO: Aquí podrías buscar el estado anterior del objeto
            }
            
            return cambios;
            
        } catch (error) {
            console.error('Error extrayendo cambios:', error);
            return cambios;
        }
    },
    
    /**
     * 🏷️ Determinar categoría y severidad de la operación
     */
    determinarCategoriaySeveridad: (url, method, codigoRespuesta) => {
        const urlLower = url.toLowerCase();
        
        let categoria = 'operacion';
        let severidad = 'info';
        
        // Determinar categoría
        if (urlLower.includes('/login') || urlLower.includes('/auth')) {
            categoria = 'seguridad';
        } else if (urlLower.includes('/report') || urlLower.includes('/export')) {
            categoria = 'reporte';
        } else if (urlLower.includes('/gps') || urlLower.includes('/ubicacion') || urlLower.includes('/iot')) {
            categoria = 'gps';
        } else if (urlLower.includes('/admin')) {
            categoria = 'admin';
        } else if (urlLower.includes('/usuario')) {
            categoria = 'usuario';
        }
        
        // Determinar severidad basada en código de respuesta
        if (codigoRespuesta >= 500) {
            severidad = 'critical';
        } else if (codigoRespuesta >= 400) {
            severidad = 'error';
        } else if (codigoRespuesta >= 300) {
            severidad = 'warning';
        } else {
            severidad = 'info';
        }
        
        // Severidad especial para operaciones críticas
        if (method === 'DELETE' || 
            (urlLower.includes('/login') && codigoRespuesta >= 400)) {
            severidad = severidad === 'info' ? 'warning' : severidad;
        }
        
        return { categoria, severidad };
    },
    
    /**
     * 🔧 Extraer módulo desde la URL
     */
    extraerModulo: (url) => {
        const partes = url.split('/').filter(p => p);
        if (partes.length >= 2) {
            return `${partes[1]}.controller`; // ej: admin.controller, usuarios.controller
        }
        return 'unknown.controller';
    },
    
    /**
     * 📊 Middleware específico para operaciones críticas
     */
    operacionCritica: (entidad, accion) => {
        return async (req, res, next) => {
            try {
                // Registrar inicio de operación crítica
                const inicioOperacion = Date.now();
                
                // Continuar con la operación
                next();
                
                // Registrar después de la operación (en el post-middleware)
                res.on('finish', async () => {
                    try {
                        const actor = await auditoriaMiddleware.extraerActor(req);
                        if (actor) {
                            await Auditoria.registrar({
                                accion,
                                entidad,
                                actor,
                                metadata: {
                                    metodo: req.method,
                                    endpoint: req.originalUrl,
                                    tiempoEjecucion: Date.now() - inicioOperacion,
                                    exitoso: res.statusCode < 400,
                                    codigoRespuesta: res.statusCode,
                                    modulo: auditoriaMiddleware.extraerModulo(req.originalUrl)
                                },
                                categoria: 'operacion',
                                severidad: 'warning' // Operaciones críticas son al menos warning
                            });
                        }
                    } catch (error) {
                        console.error('Error en auditoría de operación crítica:', error);
                    }
                });
                
            } catch (error) {
                console.error('Error en middleware de operación crítica:', error);
                next();
            }
        };
    }
};

module.exports = auditoriaMiddleware;
