const mongoose = require('./database');
const Mascota = require('./models/mascota');

const mascotaPrueba = {
    nombre: "Luna",
    especie: "Perro",
    raza: "Labrador",
    edad: 3,
    propietario: "Juan Pérez",
    signosVitales: [
        {
            tipo: "Temperatura",
            valor: 38.5,
            fecha: new Date()
        },
        {
            tipo: "Frecuencia Cardíaca",
            valor: 80,
            fecha: new Date()
        }
    ]
};

async function insertarMascotaPrueba() {
    try {
        const mascota = new Mascota(mascotaPrueba);
        await mascota.save();
        console.log('Mascota de prueba insertada correctamente');
        process.exit(0);
    } catch (error) {
        console.error('Error al insertar mascota de prueba:', error);
        process.exit(1);
    }
}

insertarMascotaPrueba();
