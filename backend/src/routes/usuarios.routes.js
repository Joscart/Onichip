const express = require('express');
const router = express.Router();

const usuariosController = require('../controllers/usuarios.controllers');


// Usuarios CRUD
router.get('/usuarios', usuariosController.getUsuarios);
router.get('/usuarios/:id', usuariosController.getUsuario);
router.post('/usuarios', usuariosController.addUsuario);
router.post('/usuarios/login', usuariosController.loginUsuario);
router.put('/usuarios/:id', usuariosController.editUsuario);
router.delete('/usuarios/:id', usuariosController.deleteUsuario);

// Ruta de prueba
router.get('/', (req, res) => {
  res.send('Bienvenido a la gestión de usuarios');
});

module.exports = router;
