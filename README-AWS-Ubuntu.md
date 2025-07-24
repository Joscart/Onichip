# 🚀 OnichipGPS - Instalación en AWS Ubuntu Server

## 📋 Descripción

Sistema completo de rastreo GPS para mascotas con servicios systemd optimizados para **Ubuntu Server en AWS EC2**. Incluye backend Node.js en puerto 3000, frontend Angular en puerto 80, y MongoDB como base de datos.

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS EC2 Ubuntu Server                    │
├─────────────────────────────────────────────────────────────┤
│  🌐 Frontend (Puerto 80)    │  🔧 Backend (Puerto 3000)    │
│  ├─ Angular 20.1.0          │  ├─ Node.js + Express        │
│  ├─ Leaflet Maps            │  ├─ MongoDB Integration      │
│  ├─ Real-time GPS           │  ├─ GPS API Endpoints        │
│  └─ Production Server       │  └─ Device Management        │
├─────────────────────────────────────────────────────────────┤
│              🗄️ MongoDB (Puerto 27017)                     │
│              Database para GPS y usuarios                   │
├─────────────────────────────────────────────────────────────┤
│               📡 ESP32 GPS Devices                         │
│               LILYGO T-Call v1.4 + GPS NEO-6M             │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Características

- ✅ **Servicios systemd** nativos para Ubuntu
- ✅ **Auto-start** en reinicio del servidor
- ✅ **Monitoreo** en tiempo real
- ✅ **Optimización AWS** para instancias t2.micro/t3.micro
- ✅ **Security hardening** incorporado
- ✅ **Logs centralizados** con journalctl
- ✅ **Health checks** automáticos
- ✅ **Firewall UFW** preconfigurado

## 🛠️ Instalación Automática

### 1. Conectar a su instancia AWS

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### 2. Clonar el proyecto

```bash
git clone https://github.com/your-repo/onichip-gps.git
cd onichip-gps
```

### 3. Ejecutar instalador automático

```bash
chmod +x install-aws-ubuntu.sh
sudo ./install-aws-ubuntu.sh
```

El script automáticamente:
- 📦 Instala Node.js 20, MongoDB, dependencias
- 🔥 Configura firewall UFW
- 📁 Crea directorios en `/opt/onichip/`
- ⚙️ Configura servicios systemd
- 🚀 Inicia todos los servicios

## 🎮 Instalación Manual

### 1. Instalar dependencias del sistema

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 22 LTS (Última versión estable)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Actualizar NPM a la última versión
sudo npm install -g npm@latest

# Instalar MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Iniciar MongoDB
sudo systemctl enable mongod
sudo systemctl start mongod
```

### 2. Crear directorios del proyecto

```bash
sudo mkdir -p /opt/onichip/{backend,frontend,logs}
sudo chown -R ubuntu:ubuntu /opt/onichip
```

### 3. Copiar archivos del proyecto

```bash
# Copiar código fuente
cp -r backend/* /opt/onichip/backend/
cp -r frontend/* /opt/onichip/frontend/

# Copiar archivos de servicios
sudo cp onichip-backend.service /etc/systemd/system/
sudo cp onichip-frontend.service /etc/systemd/system/
```

### 4. Instalar dependencias de Node.js

```bash
# Backend
cd /opt/onichip/backend
npm install --production

# Frontend
cd /opt/onichip/frontend
npm install --production
npm run build:aws
```

### 5. Configurar servicios systemd

```bash
sudo systemctl daemon-reload
sudo systemctl enable onichip-backend.service
sudo systemctl enable onichip-frontend.service
```

### 6. Configurar firewall

```bash
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 3000
sudo ufw --force enable
```

### 7. Iniciar servicios

```bash
sudo systemctl start onichip-backend
sudo systemctl start onichip-frontend
```

## 🔍 Verificación de la Instalación

### Verificar servicios

```bash
# Estado de servicios
sudo systemctl status onichip-backend
sudo systemctl status onichip-frontend

# Verificar puertos
sudo netstat -tuln | grep -E ':80|:3000|:27017'

# Health checks
curl http://localhost:80/health
curl http://18.223.160.105:3000/api/info
```

### Monitor en tiempo real

```bash
# Usar el monitor incluido
chmod +x monitor-services.sh
./monitor-services.sh monitor

# Ver logs en vivo
sudo journalctl -u onichip-backend -f
sudo journalctl -u onichip-frontend -f
```

## 🌐 URLs de Acceso

Una vez instalado, acceda a:

- **Frontend**: `http://YOUR-EC2-IP:80`
- **Backend API**: `http://YOUR-EC2-IP:3000`
- **Health Check**: `http://YOUR-EC2-IP:80/health`
- **API Info**: `http://YOUR-EC2-IP:3000/api/info`

## ⚙️ Comandos de Gestión

### Servicios

```bash
# Ver estado
sudo systemctl status onichip-backend
sudo systemctl status onichip-frontend

# Reiniciar
sudo systemctl restart onichip-backend
sudo systemctl restart onichip-frontend

# Parar
sudo systemctl stop onichip-backend
sudo systemctl stop onichip-frontend

# Iniciar
sudo systemctl start onichip-backend
sudo systemctl start onichip-frontend

# Ver logs
sudo journalctl -u onichip-backend -f
sudo journalctl -u onichip-frontend -f
```

### Aplicación

```bash
# Backend
cd /opt/onichip/backend
npm run logs          # Ver logs
npm run status        # Ver estado
npm run restart       # Reiniciar

# Frontend
cd /opt/onichip/frontend
npm run deploy:setup  # Rebuild y restart
npm run logs          # Ver logs
npm run status        # Ver estado
```

## 🐛 Solución de Problemas

### Error: Frontend no carga

```bash
# Verificar build
cd /opt/onichip/frontend
npm run build:aws

# Verificar permisos
sudo chown -R ubuntu:ubuntu /opt/onichip/frontend/dist

# Reiniciar servicio
sudo systemctl restart onichip-frontend
```

### Error: Backend no conecta a MongoDB

```bash
# Verificar MongoDB
sudo systemctl status mongod
sudo systemctl start mongod

# Verificar conexión
mongo --eval "db.runCommand({connectionStatus : 1})"
```

### Error: Servicios no inician

```bash
# Ver logs detallados
sudo journalctl -u onichip-backend --no-pager
sudo journalctl -u onichip-frontend --no-pager

# Verificar archivos de servicio
sudo systemctl cat onichip-backend
sudo systemctl cat onichip-frontend

# Recargar configuración
sudo systemctl daemon-reload
```

### Error: Puerto 80 ocupado

```bash
# Ver qué usa el puerto 80
sudo netstat -tuln | grep :80
sudo lsof -i :80

# Si hay Apache/Nginx corriendo
sudo systemctl stop apache2 nginx
sudo systemctl disable apache2 nginx
```

## 📊 Monitoreo

### Health Checks

Los servicios incluyen endpoints de health check:

- **Frontend**: `GET /health`
- **Backend**: `GET /api/health`

### Métricas del Sistema

```bash
# Uso de recursos
./monitor-services.sh status

# Monitoreo continuo
./monitor-services.sh monitor

# Solo logs
./monitor-services.sh logs
```

## 🔐 Configuración de Seguridad

### Firewall UFW

```bash
# Ver reglas activas
sudo ufw status verbose

# Permitir IP específica
sudo ufw allow from YOUR-IP to any port 3000

# Denegar acceso público al backend
sudo ufw deny 3000
```

### Variables de Entorno

Edite `/opt/onichip/.env.production` para configurar:

- JWT secrets
- URLs de CORS
- Límites de memoria
- Configuración de MongoDB

## 📁 Estructura de Archivos

```
/opt/onichip/
├── backend/
│   ├── servidor.js              # Servidor principal
│   ├── package.json            # Scripts de producción
│   └── src/                    # Código fuente
├── frontend/
│   ├── server-production.js    # Servidor Express para Angular
│   ├── package.json           # Scripts de build
│   └── dist/                  # Build de producción
├── logs/
│   └── *.log                  # Logs de aplicación
└── .env.production            # Variables de entorno

/etc/systemd/system/
├── onichip-backend.service    # Servicio backend
└── onichip-frontend.service   # Servicio frontend
```

## 🆘 Soporte

### Logs de Sistema

```bash
# Logs de servicios
sudo journalctl -u onichip-backend --since "1 hour ago"
sudo journalctl -u onichip-frontend --since "1 hour ago"

# Logs del sistema
sudo journalctl --since "1 hour ago" | grep -i error
```

### Información del Sistema

```bash
# Versiones
node --version    # Debería mostrar v22.x.x
npm --version     # Última versión de NPM
mongod --version  # MongoDB 7.0

# Recursos del sistema
free -h
df -h
top -p $(pgrep -f "node.*servidor.js|node.*server-production.js")
```

---

## 🎉 ¡Instalación Completada!

Su sistema OnichipGPS está ahora ejecutándose como servicios nativos de Ubuntu Server en AWS. Los servicios se iniciarán automáticamente al reiniciar el servidor y están optimizados para instancias EC2.

**URLs de acceso:**
- Frontend: `http://YOUR-EC2-IP:80`
- Backend: `http://YOUR-EC2-IP:3000`

**Monitoreo:**
```bash
./monitor-services.sh monitor
```
