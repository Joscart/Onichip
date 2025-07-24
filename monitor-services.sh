#!/bin/bash

# ====================== ONICHIP GPS - MONITOR DE SERVICIOS ======================
# Script de monitoreo en tiempo real para servicios systemd en Ubuntu Server
# Monitorea estado, recursos y logs de backend/frontend
# ============================================================================

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Función para limpiar pantalla y mostrar header
show_header() {
    clear
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                     🔍 ONICHIP GPS - MONITOR DE SERVICIOS                       ║${NC}"
    echo -e "${BLUE}║                      $(date '+%Y-%m-%d %H:%M:%S') - Ubuntu Server AWS                      ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Función para obtener estado del servicio con color
get_service_status() {
    local service=$1
    if systemctl is-active --quiet $service; then
        echo -e "${GREEN}🟢 ACTIVO${NC}"
    else
        echo -e "${RED}🔴 INACTIVO${NC}"
    fi
}

# Función para obtener uptime del servicio
get_service_uptime() {
    local service=$1
    local since=$(systemctl show $service --property=ActiveEnterTimestamp --value)
    if [ ! -z "$since" ] && [ "$since" != "n/a" ]; then
        local start_time=$(date -d "$since" +%s)
        local current_time=$(date +%s)
        local uptime=$((current_time - start_time))
        
        local days=$((uptime / 86400))
        local hours=$(((uptime % 86400) / 3600))
        local minutes=$(((uptime % 3600) / 60))
        
        if [ $days -gt 0 ]; then
            echo "${days}d ${hours}h ${minutes}m"
        elif [ $hours -gt 0 ]; then
            echo "${hours}h ${minutes}m"
        else
            echo "${minutes}m"
        fi
    else
        echo "n/a"
    fi
}

# Función para obtener uso de memoria del proceso
get_memory_usage() {
    local service=$1
    local pid=$(systemctl show $service --property=MainPID --value)
    if [ "$pid" != "0" ] && [ ! -z "$pid" ]; then
        local mem_kb=$(ps -o rss= -p $pid 2>/dev/null)
        if [ ! -z "$mem_kb" ]; then
            local mem_mb=$((mem_kb / 1024))
            echo "${mem_mb}MB"
        else
            echo "n/a"
        fi
    else
        echo "n/a"
    fi
}

# Función para obtener uso de CPU del proceso
get_cpu_usage() {
    local service=$1
    local pid=$(systemctl show $service --property=MainPID --value)
    if [ "$pid" != "0" ] && [ ! -z "$pid" ]; then
        local cpu=$(ps -o %cpu= -p $pid 2>/dev/null | tr -d ' ')
        if [ ! -z "$cpu" ]; then
            echo "${cpu}%"
        else
            echo "n/a"
        fi
    else
        echo "n/a"
    fi
}

# Función para verificar puertos
check_port() {
    local port=$1
    if netstat -tuln | grep -q ":$port "; then
        echo -e "${GREEN}✅ Abierto${NC}"
    else
        echo -e "${RED}❌ Cerrado${NC}"
    fi
}

# Función para mostrar estado de servicios
show_services_status() {
    echo -e "${CYAN}📊 ESTADO DE SERVICIOS${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
    
    # Backend
    local backend_status=$(get_service_status onichip-backend.service)
    local backend_uptime=$(get_service_uptime onichip-backend.service)
    local backend_memory=$(get_memory_usage onichip-backend.service)
    local backend_cpu=$(get_cpu_usage onichip-backend.service)
    local backend_port=$(check_port 3000)
    
    echo -e "${YELLOW}🔧 BACKEND (Puerto 3000)${NC}"
    echo -e "   Estado:    $backend_status"
    echo -e "   Uptime:    ${CYAN}$backend_uptime${NC}"
    echo -e "   Memoria:   ${CYAN}$backend_memory${NC}"
    echo -e "   CPU:       ${CYAN}$backend_cpu${NC}"
    echo -e "   Puerto:    $backend_port"
    echo ""
    
    # Frontend  
    local frontend_status=$(get_service_status onichip-frontend.service)
    local frontend_uptime=$(get_service_uptime onichip-frontend.service)
    local frontend_memory=$(get_memory_usage onichip-frontend.service)
    local frontend_cpu=$(get_cpu_usage onichip-frontend.service)
    local frontend_port=$(check_port 80)
    
    echo -e "${YELLOW}🌐 FRONTEND (Puerto 80)${NC}"
    echo -e "   Estado:    $frontend_status"
    echo -e "   Uptime:    ${CYAN}$frontend_uptime${NC}"
    echo -e "   Memoria:   ${CYAN}$frontend_memory${NC}"
    echo -e "   CPU:       ${CYAN}$frontend_cpu${NC}"
    echo -e "   Puerto:    $frontend_port"
    echo ""
    
    # MongoDB
    local mongo_status=$(get_service_status mongod.service)
    local mongo_uptime=$(get_service_uptime mongod.service)
    local mongo_memory=$(get_memory_usage mongod.service)
    local mongo_cpu=$(get_cpu_usage mongod.service)
    local mongo_port=$(check_port 27017)
    
    echo -e "${YELLOW}🗄️ MONGODB (Puerto 27017)${NC}"
    echo -e "   Estado:    $mongo_status"
    echo -e "   Uptime:    ${CYAN}$mongo_uptime${NC}"
    echo -e "   Memoria:   ${CYAN}$mongo_memory${NC}"
    echo -e "   CPU:       ${CYAN}$mongo_cpu${NC}"
    echo -e "   Puerto:    $mongo_port"
}

# Función para mostrar información del sistema
show_system_info() {
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}💻 INFORMACIÓN DEL SISTEMA${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
    
    # Información básica
    local hostname=$(hostname)
    local uptime=$(uptime -p)
    local load=$(uptime | awk -F'load average:' '{print $2}' | sed 's/^[ \t]*//')
    local memory=$(free -h | awk '/^Mem:/ {print $3 "/" $2}')
    local disk=$(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 " usado)"}')
    
    echo -e "   🖥️  Servidor:     ${CYAN}$hostname${NC}"
    echo -e "   ⏱️  Uptime:       ${CYAN}$uptime${NC}"
    echo -e "   📊 Load Avg:     ${CYAN}$load${NC}"
    echo -e "   🧠 Memoria:      ${CYAN}$memory${NC}"
    echo -e "   💾 Disco /:      ${CYAN}$disk${NC}"
    
    # IP pública
    local public_ip=$(curl -s --max-time 5 ipinfo.io/ip || echo "n/a")
    echo -e "   🌐 IP Pública:   ${CYAN}$public_ip${NC}"
}

# Función para mostrar logs recientes
show_recent_logs() {
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}📋 LOGS RECIENTES (Últimas 5 líneas)${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
    
    echo -e "${YELLOW}🔧 Backend:${NC}"
    journalctl -u onichip-backend.service --no-pager -n 3 --output=short || echo "   No hay logs disponibles"
    echo ""
    
    echo -e "${YELLOW}🌐 Frontend:${NC}"
    journalctl -u onichip-frontend.service --no-pager -n 3 --output=short || echo "   No hay logs disponibles"
}

# Función para mostrar URLs de acceso
show_access_urls() {
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}🔗 URLs DE ACCESO${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
    
    local public_ip=$(curl -s --max-time 5 ipinfo.io/ip || echo "localhost")
    
    echo -e "   🌐 Frontend:       ${GREEN}http://$public_ip:80${NC}"
    echo -e "   🔧 Backend API:    ${GREEN}http://$public_ip:3000${NC}"
    echo -e "   ❤️  Health Check:  ${GREEN}http://$public_ip:80/health${NC}"
    echo -e "   📊 Backend Info:   ${GREEN}http://$public_ip:3000/api/info${NC}"
}

# Función para mostrar comandos útiles
show_useful_commands() {
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}⚙️ COMANDOS ÚTILES${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "   ${YELLOW}Ver logs en vivo:${NC}      sudo journalctl -u onichip-backend -f"
    echo -e "   ${YELLOW}Reiniciar backend:${NC}     sudo systemctl restart onichip-backend"
    echo -e "   ${YELLOW}Reiniciar frontend:${NC}    sudo systemctl restart onichip-frontend"
    echo -e "   ${YELLOW}Estado detallado:${NC}      sudo systemctl status onichip-backend"
    echo -e "   ${YELLOW}Parar servicios:${NC}       sudo systemctl stop onichip-{backend,frontend}"
    echo -e "   ${YELLOW}Iniciar servicios:${NC}     sudo systemctl start onichip-{backend,frontend}"
}

# Función principal de monitoreo
monitor_loop() {
    while true; do
        show_header
        show_services_status
        show_system_info
        show_recent_logs
        show_access_urls
        show_useful_commands
        
        echo -e "\n${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
        echo -e "${CYAN}🔄 Actualizando en 30 segundos... (Ctrl+C para salir)${NC}"
        echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
        
        sleep 30
    done
}

# Función para mostrar una sola vez (no loop)
show_once() {
    show_header
    show_services_status
    show_system_info
    show_recent_logs
    show_access_urls
    show_useful_commands
}

# Función de ayuda
show_help() {
    echo -e "${BLUE}🔍 ONICHIP GPS - Monitor de Servicios${NC}"
    echo ""
    echo -e "${YELLOW}Uso:${NC}"
    echo -e "   $0 [opción]"
    echo ""
    echo -e "${YELLOW}Opciones:${NC}"
    echo -e "   ${GREEN}monitor${NC}    Monitoreo continuo (actualiza cada 30s)"
    echo -e "   ${GREEN}status${NC}     Mostrar estado actual una vez"
    echo -e "   ${GREEN}logs${NC}       Mostrar logs en tiempo real"
    echo -e "   ${GREEN}restart${NC}    Reiniciar todos los servicios"
    echo -e "   ${GREEN}help${NC}       Mostrar esta ayuda"
    echo ""
    echo -e "${YELLOW}Ejemplos:${NC}"
    echo -e "   $0 monitor     # Monitoreo continuo"
    echo -e "   $0 status      # Estado actual"
    echo -e "   $0 logs        # Ver logs en vivo"
}

# Manejar argumentos de línea de comandos
case "${1:-monitor}" in
    "monitor")
        monitor_loop
        ;;
    "status")
        show_once
        ;;
    "logs")
        echo -e "${CYAN}📋 Logs en tiempo real (Ctrl+C para salir)${NC}"
        echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
        journalctl -u onichip-backend.service -u onichip-frontend.service -f
        ;;
    "restart")
        echo -e "${YELLOW}🔄 Reiniciando servicios OnichipGPS...${NC}"
        sudo systemctl restart onichip-backend.service
        sudo systemctl restart onichip-frontend.service
        echo -e "${GREEN}✅ Servicios reiniciados${NC}"
        show_once
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo -e "${RED}❌ Opción no válida: $1${NC}"
        show_help
        exit 1
        ;;
esac
