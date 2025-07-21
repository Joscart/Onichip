const mongoose = require('mongoose');

async function convertToObjectId() {
    try {
        console.log('🔍 Conectando a MongoDB...');
        await mongoose.connect('mongodb+srv://danielyug:leinad2003@cluster0.mqsi2ll.mongodb.net/onichipdb');
        console.log('✅ Conectado');
        
        console.log('\n🔧 Convirtiendo propietarios a ObjectId...');
        
        const db = mongoose.connection.db;
        const mascotas = await db.collection('mascotas').find({}).toArray();
        
        for (const mascota of mascotas) {
            if (typeof mascota.propietario === 'string') {
                console.log(`🐕 Convirtiendo ${mascota.nombre}...`);
                console.log(`   De: ${mascota.propietario} (${typeof mascota.propietario})`);
                
                const objectId = new mongoose.Types.ObjectId(mascota.propietario);
                
                await db.collection('mascotas').updateOne(
                    { _id: mascota._id },
                    { $set: { propietario: objectId } }
                );
                
                console.log(`   A: ${objectId} (ObjectId)`);
            }
        }
        
        console.log('\n🔍 Verificación final...');
        const mascotasUpdated = await db.collection('mascotas').find({}).toArray();
        
        mascotasUpdated.forEach(m => {
            console.log(`🐕 ${m.nombre}: propietario ${m.propietario} (${m.propietario.constructor.name})`);
        });
        
        mongoose.disconnect();
        console.log('\n✅ Conversión completada');
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

convertToObjectId();
