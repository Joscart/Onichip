#!/bin/bash
# Script para iniciar backend y frontend de Onichip en Linux/Mac

# Iniciar backend en una terminal separada
# Iniciar backend en segundo plano
(cd backend && npm install && npm run start) &

# Iniciar frontend en otra terminal separada
# Iniciar frontend en segundo plano
(cd frontend && npm install && npm start) &

wait
# Esperar a que ambos procesos terminen
wait
