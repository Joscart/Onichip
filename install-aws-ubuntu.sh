#!/bin/bash

# ====================== ONICHIP GPS - INSTALADOR AWS UBUNTU SERVER ======================
# Script de instalación automática para sistemas Ubuntu Server en AWS EC2
# Instala y configura servicios systemd para producción
# =====================================================================================

set -e  # Salir en caso de error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables de configuración
INSTALL_DIR="/opt/onichip"
SERVICE_USER="ubuntu"
BACKEND_PORT="3000"
FRONTEND_PORT="80"
NODE_VERSION="22"  # Última versión LTS estable

echo -e "${BLUE}🚀 ================================================================${NC}"
echo -e "${BLUE}🎯 INSTALADOR ONICHIP GPS - AWS UBUNTU SERVER${NC}"
echo -e "${BLUE}🚀 ================================================================${NC}"
echo -e "${GREEN}📦 Sistema: $(lsb_release -d | cut -f2)${NC}"
echo -e "${GREEN}💻 Usuario: $USER${NC}"
echo -e "${GREEN}📁 Directorio: $INSTALL_DIR${NC}"
echo -e "${BLUE}🚀 ================================================================${NC}"

# Función para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Verificar que se ejecuta como root o con sudo
if [ "$EUID" -ne 0 ]; then
    error "Este script debe ejecutarse como root o con sudo"
fi

# 1. Actualizar sistema
log "🔄 Actualizando sistema Ubuntu..."
apt update && apt upgrade -y

# 2. Instalar dependencias del sistema
log "📦 Instalando dependencias del sistema..."
apt install -y curl wget git build-essential software-properties-common ufw nginx-core

# 3. Instalar Node.js y npm
log "📦 Instalando Node.js $NODE_VERSION (LTS estable)..."

# Verificar si Node.js ya está instalado
if command -v node &> /dev/null; then
    CURRENT_NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    log "🔍 Node.js ya instalado: v$(node --version | cut -d'v' -f2)"
    
    if [ "$CURRENT_NODE_VERSION" -lt "$NODE_VERSION" ]; then
        log "🔄 Actualizando Node.js a versión $NODE_VERSION..."
    else
        log "✅ Node.js ya está en versión adecuada o superior"
    fi
fi

# Instalar/actualizar Node.js
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# Verificar instalación
if command -v node &> /dev/null && command -v npm &> /dev/null; then
    log "✅ Node.js instalado: $(node --version)"
    log "✅ NPM instalado: $(npm --version)"
    
    # Actualizar npm a la última versión
    log "📦 Actualizando NPM a la última versión..."
    npm install -g npm@latest
    log "✅ NPM actualizado: $(npm --version)"
else
    error "❌ Error en la instalación de Node.js/NPM"
fi

# 4. Instalar MongoDB
log "📦 Instalando MongoDB..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update
apt-get install -y mongodb-org

# Configurar MongoDB para autostart
systemctl enable mongod
systemctl start mongod
log "✅ MongoDB iniciado y habilitado"

# 5. Crear directorio de instalación
log "📁 Creando directorio de instalación..."
mkdir -p $INSTALL_DIR
mkdir -p $INSTALL_DIR/backend
mkdir -p $INSTALL_DIR/frontend
mkdir -p $INSTALL_DIR/logs

# 6. Configurar permisos
log "🔐 Configurando permisos..."
chown -R $SERVICE_USER:$SERVICE_USER $INSTALL_DIR

# 7. Configurar firewall
log "🔥 Configurando firewall UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow $BACKEND_PORT
ufw allow $FRONTEND_PORT
ufw allow 27017  # MongoDB
ufw --force enable
log "✅ Firewall configurado"

# 8. Función para copiar archivos del proyecto
copy_project_files() {
    log "📂 Copiando archivos del proyecto..."
    
    # Detectar directorio actual del proyecto
    CURRENT_DIR=$(pwd)
    
    if [ -d "$CURRENT_DIR/backend" ] && [ -d "$CURRENT_DIR/frontend" ]; then
        log "📦 Copiando backend..."
        cp -r $CURRENT_DIR/backend/* $INSTALL_DIR/backend/
        
        log "📦 Copiando frontend..."
        cp -r $CURRENT_DIR/frontend/* $INSTALL_DIR/frontend/
        
        # Copiar archivos de servicio
        if [ -f "$CURRENT_DIR/onichip-backend.service" ]; then
            cp $CURRENT_DIR/onichip-backend.service /etc/systemd/system/
        fi
        
        if [ -f "$CURRENT_DIR/onichip-frontend.service" ]; then
            cp $CURRENT_DIR/onichip-frontend.service /etc/systemd/system/
        fi
        
        log "✅ Archivos copiados correctamente"
    else
        warning "No se encontraron directorios backend/frontend en $CURRENT_DIR"
        log "📝 Instrucciones manuales:"
        echo "   1. Copie sus archivos a $INSTALL_DIR/backend y $INSTALL_DIR/frontend"
        echo "   2. Copie los archivos .service a /etc/systemd/system/"
        echo "   3. Ejecute: sudo systemctl daemon-reload"
    fi
}

# 9. Instalar dependencias del proyecto
install_dependencies() {
    log "📦 Instalando dependencias del backend..."
    cd $INSTALL_DIR/backend
    
    # Verificar compatibilidad de Node.js
    NODE_MAJOR_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR_VERSION" -ge 18 ]; then
        log "✅ Node.js v$NODE_MAJOR_VERSION compatible con el proyecto"
    else
        warning "⚠️ Node.js v$NODE_MAJOR_VERSION puede tener problemas de compatibilidad"
    fi
    
    # Limpiar cache de npm para evitar conflictos
    npm cache clean --force
    
    # Instalar dependencias con verificación de integridad
    npm install --production --audit --fund=false
    
    log "📦 Instalando dependencias del frontend..."
    cd $INSTALL_DIR/frontend
    
    # Limpiar cache
    npm cache clean --force
    
    # Instalar dependencias
    npm install --production --audit --fund=false
    
    # Instalar compression para el servidor de producción
    npm install compression --save
    
    # Verificar que Angular CLI esté disponible globalmente
    if ! command -v ng &> /dev/null; then
        log "📦 Instalando Angular CLI globalmente..."
        npm install -g @angular/cli@latest
    fi
    
    log "🏗️ Construyendo frontend para producción..."
    npm run build:aws || warning "Error en build - verifique manualmente"
}

# 10. Configurar servicios systemd
configure_services() {
    log "🔧 Configurando servicios systemd..."
    
    # Recargar systemd
    systemctl daemon-reload
    
    # Habilitar servicios
    systemctl enable onichip-backend.service || warning "Error habilitando backend service"
    systemctl enable onichip-frontend.service || warning "Error habilitando frontend service"
    
    log "✅ Servicios systemd configurados"
}

# 11. Función para iniciar servicios
start_services() {
    log "🚀 Iniciando servicios OnichipGPS..."
    
    # Iniciar backend
    systemctl start onichip-backend.service
    sleep 5
    
    # Verificar backend
    if systemctl is-active --quiet onichip-backend.service; then
        log "✅ Backend iniciado correctamente en puerto $BACKEND_PORT"
    else
        error "❌ Error iniciando backend. Revise: sudo journalctl -u onichip-backend"
    fi
    
    # Iniciar frontend
    systemctl start onichip-frontend.service
    sleep 5
    
    # Verificar frontend
    if systemctl is-active --quiet onichip-frontend.service; then
        log "✅ Frontend iniciado correctamente en puerto $FRONTEND_PORT"
    else
        warning "❌ Error iniciando frontend. Revise: sudo journalctl -u onichip-frontend"
    fi
}

# 12. Mostrar estado final
show_status() {
    echo -e "${BLUE}📊 ================================================================${NC}"
    echo -e "${BLUE}📈 ESTADO FINAL DE LA INSTALACIÓN${NC}"
    echo -e "${BLUE}📊 ================================================================${NC}"
    
    echo -e "${GREEN}🔍 Estado de servicios:${NC}"
    systemctl status onichip-backend.service --no-pager || true
    echo ""
    systemctl status onichip-frontend.service --no-pager || true
    
    echo -e "${BLUE}📊 ================================================================${NC}"
    echo -e "${GREEN}🌐 URLs de acceso:${NC}"
    echo -e "${YELLOW}   Frontend: http://$(curl -s ipinfo.io/ip):$FRONTEND_PORT${NC}"
    echo -e "${YELLOW}   Backend:  http://$(curl -s ipinfo.io/ip):$BACKEND_PORT${NC}"
    echo -e "${YELLOW}   Health:   http://$(curl -s ipinfo.io/ip):$FRONTEND_PORT/health${NC}"
    
    echo -e "${GREEN}📝 Comandos útiles:${NC}"
    echo -e "${YELLOW}   sudo systemctl status onichip-backend${NC}"
    echo -e "${YELLOW}   sudo systemctl status onichip-frontend${NC}"
    echo -e "${YELLOW}   sudo journalctl -u onichip-backend -f${NC}"
    echo -e "${YELLOW}   sudo journalctl -u onichip-frontend -f${NC}"
    
    echo -e "${BLUE}📊 ================================================================${NC}"
}

# Ejecutar instalación
main() {
    copy_project_files
    install_dependencies
    configure_services
    start_services
    show_status
    
    log "🎉 ¡Instalación completada! OnichipGPS está funcionando en AWS Ubuntu Server"
}

# Ejecutar función principal
main
