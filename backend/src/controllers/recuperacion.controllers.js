/**
 * ================================================
 * 🔑 RECUPERACIÓN CONTROLLER - RECUPERACIÓN DE CONTRASEÑAS
 * ================================================
 * 
 * Controlador para recuperación de contraseñas de usuarios
 * Incluye validación de email y cambio de contraseña
 * 
 * @author Onichip Team
 * @version 2.0
 */

const bcrypt = require('bcryptjs');
const Usuario = require('../models/usuario');

console.log('🔧 Controladores de recuperación cargados');

/**
 * 🔍 Test de conexión
 * 
 * @description Endpoint de prueba para verificar funcionamiento del servidor
 * @route GET /api/test
 * @access Public
 * 
 * @input None - No requiere parámetros
 * 
 * @output {Object} 200 - Servidor funcionando correctamente
 * @output {Object} 500 - Error interno del servidor
 */
const testConexion = async (req, res) => {
  try {
    console.log('🔍 Test de conexión iniciado');
    res.status(200).json({ 
      message: 'Servidor funcionando correctamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en test:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * 📧 Validar email para recuperación
 * 
 * @description Valida si un email existe en el sistema para permitir recuperación
 * @route POST /api/validar-email
 * @access Public
 * 
 * @input {Object} req.body - Datos de validación
 * @input {string} req.body.email - Email a validar
 * 
 * @output {Object} 200 - Email válido, puede proceder con recuperación
 * @output {Object} 400 - Email requerido
 * @output {Object} 404 - No existe cuenta con ese email
 * @output {Object} 500 - Error interno del servidor
 */
const validarEmail = async (req, res) => {
  console.log('📧 Validando email:', req.body);
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'El correo electrónico es requerido' });
    }

    // Buscar usuario por email en la base de datos
    console.log('🔍 Buscando usuario en MongoDB...');
    const usuario = await Usuario.findOne({ email });

    if (!usuario) {
      console.log('❌ Usuario no encontrado');
      return res.status(404).json({ message: 'No existe una cuenta con este correo electrónico' });
    }

    console.log('✅ Usuario encontrado:', usuario.email);
    // Si el usuario existe, devolver éxito (sin exponer datos sensibles)
    res.status(200).json({ 
      message: 'Correo electrónico válido',
      emailValido: true,
      usuarioId: usuario._id 
    });

  } catch (error) {
    console.error('Error al validar email:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Actualizar contraseña
const actualizarContrasena = async (req, res) => {
  try {
    const { email, nuevaContrasena } = req.body;

    if (!email || !nuevaContrasena) {
      return res.status(400).json({ message: 'Email y nueva contraseña son requeridos' });
    }

    if (nuevaContrasena.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Buscar usuario por email
    const usuario = await Usuario.findOne({ email });

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Encriptar nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(nuevaContrasena, salt);

    // Actualizar contraseña en la base de datos
    await Usuario.findByIdAndUpdate(usuario._id, { 
      password: hashedPassword 
    });

    res.status(200).json({ 
      message: 'Contraseña actualizada exitosamente',
      success: true 
    });

  } catch (error) {
    console.error('Error al actualizar contraseña:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

module.exports = {
  testConexion,
  validarEmail,
  actualizarContrasena
};