const mongoose = require('./src/database');
const Usuario = require('./src/models/usuario');

async function limpiarUsuarios() {
    try {
        console.log('🧹 Limpiando usuarios de la base de datos...');
        
        const result = await Usuario.deleteMany({});
        console.log(`✅ ${result.deletedCount} usuarios eliminados`);
        
        console.log('🎉 Base de datos limpia. Ahora puedes registrar usuarios nuevos.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error al limpiar usuarios:', error);
        process.exit(1);
    }
}

limpiarUsuarios();
