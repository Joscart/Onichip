const mongoose = require('mongoose');

async function fixMascotasRelations() {
    try {
        console.log('🔍 Conectando a MongoDB...');
        await mongoose.connect('mongodb+srv://danielyug:leinad2003@cluster0.mqsi2ll.mongodb.net/onichipdb');
        console.log('✅ Conectado');
        
        const Usuario = mongoose.model('Usuario', new mongoose.Schema({
            nombre: String,
            email: String,
            password: String,
            telefono: String,
            fechaRegistro: { type: Date, default: Date.now }
        }));
        
        const Mascota = mongoose.model('Mascota', new mongoose.Schema({
            nombre: String,
            especie: String,
            raza: String,
            edad: Number,
            propietario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
            fechaRegistro: { type: Date, default: Date.now }
        }));
        
        console.log('\n🔧 Arreglando relaciones...');
        
        const mascotas = await Mascota.find({});
        
        for (const mascota of mascotas) {
            console.log(`\n🐕 Procesando: ${mascota.nombre}`);
            console.log(`   Propietario actual: ${mascota.propietario} (tipo: ${typeof mascota.propietario})`);
            
            // Si el propietario es un string, convertirlo a ObjectId
            if (typeof mascota.propietario === 'string') {
                try {
                    const objectId = new mongoose.Types.ObjectId(mascota.propietario);
                    await Mascota.findByIdAndUpdate(mascota._id, { 
                        propietario: objectId 
                    });
                    console.log(`   ✅ Convertido a ObjectId: ${objectId}`);
                } catch (error) {
                    console.log(`   ❌ Error convirtiendo: ${error.message}`);
                }
            } else {
                console.log(`   ✅ Ya es ObjectId`);
            }
        }
        
        console.log('\n🔗 Verificando después de la corrección:');
        const usuarios = await Usuario.find({});
        for (const usuario of usuarios) {
            const count = await Mascota.countDocuments({ propietario: usuario._id });
            console.log(`${usuario.nombre}: ${count} mascotas`);
        }
        
        mongoose.disconnect();
        console.log('\n✅ Proceso completado');
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

fixMascotasRelations();
