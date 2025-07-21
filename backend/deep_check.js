const mongoose = require('mongoose');

async function deepCheck() {
    try {
        console.log('🔍 Conectando a MongoDB...');
        await mongoose.connect('mongodb+srv://danielyug:leinad2003@cluster0.mqsi2ll.mongodb.net/onichipdb');
        console.log('✅ Conectado');
        
        console.log('\n🔍 Revisión detallada...');
        
        // Obtener datos directamente de la base de datos
        const db = mongoose.connection.db;
        
        const usuarios = await db.collection('usuarios').find({}).toArray();
        const mascotas = await db.collection('mascotas').find({}).toArray();
        
        console.log('\n👥 USUARIOS RAW:');
        usuarios.forEach(u => {
            console.log(`ID: ${u._id} (${u._id.constructor.name}), Nombre: ${u.nombre}`);
        });
        
        console.log('\n🐕 MASCOTAS RAW:');
        mascotas.forEach(m => {
            console.log(`ID: ${m._id}, Nombre: ${m.nombre}`);
            console.log(`   Propietario: ${m.propietario} (${m.propietario.constructor.name})`);
            console.log(`   Propietario toString: ${m.propietario.toString()}`);
        });
        
        console.log('\n🔗 COMPARACIONES MANUALES:');
        for (const usuario of usuarios) {
            console.log(`\n👤 Usuario: ${usuario.nombre}`);
            console.log(`   ID: ${usuario._id.toString()}`);
            
            for (const mascota of mascotas) {
                const propietarioStr = mascota.propietario.toString();
                const usuarioStr = usuario._id.toString();
                const match = propietarioStr === usuarioStr;
                
                console.log(`   🐕 ${mascota.nombre}: ${propietarioStr} == ${usuarioStr} ? ${match}`);
            }
        }
        
        mongoose.disconnect();
        console.log('\n✅ Revisión completada');
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

deepCheck();
