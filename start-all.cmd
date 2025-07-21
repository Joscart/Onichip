@echo off
REM Script para iniciar backend y frontend de Onichip en Windows

REM Iniciar backend
start "Backend" cmd /k "cd backend && npm install && npm run dev"

REM Iniciar frontend
start "Frontend" cmd /k "cd frontend && npm install && npm start"

exit
