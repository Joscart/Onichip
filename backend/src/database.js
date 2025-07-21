const mongoose = require('mongoose');
mongoose.set('strictQuery', false); // Para evitar advertencias de Mongoose


const URI = 'mongodb+srv://joscart:Jose1234@cluster0.cvc2htm.mongodb.net/onichip'
mongoose.connect(URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error de conexión a MongoDB:', err));

module.exports = mongoose;