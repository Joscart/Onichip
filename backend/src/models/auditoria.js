/**
 * ================================================
 * 🕵️ MODELO DE AUDITORÍA - SISTEMA DE TRAZABILIDAD
 * ================================================
 * 
 * Modelo para registrar todas las operaciones realizadas en el sistema
 * Incluye seguimiento de usuarios, admins, mascotas, ubicaciones y reportes
 * 
 * @author Onichip Team
 * @version 1.0
 */

const mongoose = require('mongoose');

/**
 * 📋 Schema de Auditoría
 * 
 * Registra todas las operaciones CRUD y acciones importantes del sistema
 */
const auditoriaSchema = new mongoose.Schema({
    // ================================
    // 📊 INFORMACIÓN BÁSICA DE LA ACCIÓN
    // ================================
    timestamp: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
    },
    
    accion: {
        type: String,
        required: true,
        enum: [
            // Operaciones CRUD básicas
            'CREATE', 'READ', 'UPDATE', 'DELETE',
            // Operaciones de autenticación
            'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
            // Operaciones específicas
            'GENERATE_REPORT', 'EXPORT_DATA', 'GPS_UPDATE', 'ALERT_TRIGGERED'
        ],
        index: true
    },
    
    entidad: {
        type: String,
        required: true,
        enum: [
            'usuario', 'mascota', 'admin', 'ubicacion', 'geofence', 
            'reporte', 'datos_iot', 'recuperacion', 'sistema'
        ],
        index: true
    },
    
    // ================================
    // 👤 INFORMACIÓN DEL ACTOR
    // ================================
    actor: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true
        },
        tipo: {
            type: String,
            required: true,
            enum: ['admin', 'usuario', 'sistema'],
            index: true
        },
        email: {
            type: String,
            required: true
        },
        nombre: {
            type: String,
            required: true
        },
        ip: {
            type: String,
            default: 'unknown'
        },
        userAgent: {
            type: String,
            default: 'unknown'
        }
    },
    
    // ================================
    // 🎯 INFORMACIÓN DEL OBJETIVO
    // ================================
    objetivo: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            index: true
        },
        tipo: {
            type: String,
            enum: ['usuario', 'mascota', 'ubicacion', 'reporte', 'admin', 'sistema']
        },
        nombre: String, // Nombre descriptivo del objetivo
        
        // Información específica según el tipo
        detalles: {
            // Para usuarios
            email: String,
            telefono: String,
            
            // Para mascotas
            especie: String,
            raza: String,
            propietario: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Usuario'
            },
            
            // Para ubicaciones
            latitud: Number,
            longitud: Number,
            precision: Number,
            
            // Para reportes
            tipoReporte: String,
            parametros: mongoose.Schema.Types.Mixed
        }
    },
    
    // ================================
    // 📝 CAMBIOS REALIZADOS
    // ================================
    cambios: {
        // Estado anterior (para operaciones UPDATE/DELETE)
        anterior: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        
        // Estado nuevo (para operaciones CREATE/UPDATE)
        nuevo: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        
        // Campos específicos que cambiaron
        camposModificados: [{
            campo: String,
            valorAnterior: mongoose.Schema.Types.Mixed,
            valorNuevo: mongoose.Schema.Types.Mixed
        }]
    },
    
    // ================================
    // 🔍 METADATOS ADICIONALES
    // ================================
    metadata: {
        // Información de la solicitud HTTP
        metodo: {
            type: String,
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
        },
        endpoint: String,
        headers: mongoose.Schema.Types.Mixed,
        query: mongoose.Schema.Types.Mixed,
        body: mongoose.Schema.Types.Mixed,
        
        // Información del sistema
        version: {
            type: String,
            default: '2.0'
        },
        modulo: String, // controlador que ejecutó la acción
        
        // Información de contexto
        sesion: String,
        transaccion: String, // Para agrupar operaciones relacionadas
        
        // Información de rendimiento
        tiempoEjecucion: Number, // en milisegundos
        memoria: Number, // uso de memoria
        
        // Estado del resultado
        exitoso: {
            type: Boolean,
            default: true
        },
        codigoRespuesta: Number,
        mensajeError: String
    },
    
    // ================================
    // 🏷️ CATEGORIZACIÓN Y FILTROS
    // ================================
    categoria: {
        type: String,
        enum: [
            'seguridad', 'operacion', 'reporte', 'sistema', 
            'gps', 'dispositivo', 'usuario', 'admin'
        ],
        default: 'operacion',
        index: true
    },
    
    severidad: {
        type: String,
        enum: ['info', 'warning', 'error', 'critical'],
        default: 'info',
        index: true
    },
    
    // ================================
    // 🔗 RELACIONES CONTEXTUALES
    // ================================
    relaciones: {
        // Para operaciones que afectan múltiples entidades
        usuarioAfectado: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Usuario'
        },
        mascotaAfectada: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Mascota'
        },
        adminResponsable: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin'
        },
        
        // Para agrupar operaciones relacionadas
        operacionPadre: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Auditoria' // Self-reference para operaciones complejas
        },
        operacionesHijas: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Auditoria'
        }]
    },
    
    // ================================
    // 🏃‍♂️ INFORMACIÓN DE ESTADO
    // ================================
    estado: {
        type: String,
        enum: ['pendiente', 'completado', 'fallido', 'cancelado'],
        default: 'completado'
    },
    
    // ================================
    // 🔍 BÚSQUEDA Y ANÁLISIS
    // ================================
    tags: [String], // Para facilitar búsquedas y análisis
    
    // Información agregada para reportes
    resumen: {
        type: String,
        required: true // Descripción legible de la acción
    },
    
    // Para retención de datos
    retencion: {
        expiraEn: {
            type: Date,
            index: { expireAfterSeconds: 0 } // TTL index
        },
        importancia: {
            type: String,
            enum: ['baja', 'media', 'alta', 'critica'],
            default: 'media'
        }
    }
}, {
    timestamps: true, // Agrega createdAt y updatedAt automáticamente
    versionKey: false
});

// ================================
// 📊 ÍNDICES PARA OPTIMIZACIÓN
// ================================
auditoriaSchema.index({ timestamp: -1, actor: 1 });
auditoriaSchema.index({ entidad: 1, accion: 1, timestamp: -1 });
auditoriaSchema.index({ 'actor.tipo': 1, 'actor.id': 1, timestamp: -1 });
auditoriaSchema.index({ categoria: 1, severidad: 1, timestamp: -1 });
auditoriaSchema.index({ estado: 1, timestamp: -1 });
auditoriaSchema.index({ tags: 1 });

// Índice compuesto para búsquedas complejas
auditoriaSchema.index({
    'actor.tipo': 1,
    entidad: 1,
    accion: 1,
    timestamp: -1
});

// ================================
// 🔧 MÉTODOS ESTÁTICOS
// ================================

/**
 * 📝 Crear registro de auditoría simplificado
 */
auditoriaSchema.statics.registrar = async function(datos) {
    const {
        accion,
        entidad,
        actor,
        objetivo = {},
        cambios = {},
        metadata = {},
        categoria = 'operacion',
        severidad = 'info'
    } = datos;
    
    // Generar resumen automático
    const resumen = `${actor.nombre} (${actor.tipo}) ${accion.toLowerCase()} ${entidad}${objetivo.nombre ? `: ${objetivo.nombre}` : ''}`;
    
    // Establecer retención basada en importancia
    let expiraEn = null;
    if (categoria === 'sistema' || severidad === 'critical') {
        expiraEn = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 año
    } else if (severidad === 'error') {
        expiraEn = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 6 meses
    } else {
        expiraEn = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 3 meses
    }
    
    const registro = new this({
        accion,
        entidad,
        actor,
        objetivo,
        cambios,
        metadata,
        categoria,
        severidad,
        resumen,
        retencion: {
            expiraEn,
            importancia: severidad === 'critical' ? 'critica' : 
                        severidad === 'error' ? 'alta' : 'media'
        }
    });
    
    return await registro.save();
};

/**
 * 📊 Obtener estadísticas de auditoría
 */
auditoriaSchema.statics.obtenerEstadisticas = async function(filtros = {}) {
    const pipeline = [
        { $match: filtros },
        {
            $group: {
                _id: {
                    accion: '$accion',
                    entidad: '$entidad',
                    tipo_actor: '$actor.tipo'
                },
                count: { $sum: 1 },
                ultimo: { $max: '$timestamp' }
            }
        },
        { $sort: { count: -1 } }
    ];
    
    return await this.aggregate(pipeline);
};

// ================================
// 🔧 MÉTODOS DE INSTANCIA
// ================================

/**
 * 🏷️ Agregar tags dinámicamente
 */
auditoriaSchema.methods.agregarTags = function(nuevosTags) {
    if (Array.isArray(nuevosTags)) {
        this.tags = [...new Set([...this.tags, ...nuevosTags])];
    } else {
        this.tags = [...new Set([...this.tags, nuevosTags])];
    }
    return this.save();
};

/**
 * 🔗 Vincular operación hija
 */
auditoriaSchema.methods.vincularOperacionHija = function(operacionHijaId) {
    if (!this.relaciones.operacionesHijas.includes(operacionHijaId)) {
        this.relaciones.operacionesHijas.push(operacionHijaId);
    }
    return this.save();
};

// ================================
// 🎯 MIDDLEWARE PRE/POST
// ================================

// Middleware para agregar tags automáticos
auditoriaSchema.pre('save', function(next) {
    // Tags automáticos basados en la acción y entidad
    const tagsAutomaticos = [
        this.accion.toLowerCase(),
        this.entidad,
        this.actor.tipo,
        this.categoria
    ];
    
    // Agregar tags específicos según el contexto
    if (this.severidad === 'error' || this.severidad === 'critical') {
        tagsAutomaticos.push('error');
    }
    
    if (this.accion === 'LOGIN' || this.accion === 'LOGOUT') {
        tagsAutomaticos.push('autenticacion');
    }
    
    if (this.entidad === 'ubicacion' || this.entidad === 'datos_iot') {
        tagsAutomaticos.push('iot', 'gps');
    }
    
    this.tags = [...new Set([...this.tags, ...tagsAutomaticos])];
    next();
});

// Middleware post-save para logging
auditoriaSchema.post('save', function(doc) {
    if (doc.severidad === 'error' || doc.severidad === 'critical') {
        console.error(`🚨 AUDITORÍA CRÍTICA: ${doc.resumen}`, {
            id: doc._id,
            timestamp: doc.timestamp,
            actor: doc.actor.email
        });
    }
});

const Auditoria = mongoose.model('Auditoria', auditoriaSchema);

module.exports = Auditoria;
