import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../app/services/auth.service';
import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import * as ExcelJS from 'exceljs';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

// Importar interfaces refactorizadas
import {
  ExcelExportRequest,
  ReportResponse,
  ReportFilters,
  DashboardMetrics,
  AdminData,
  TipoReporte,
  ChartData,
  ReporteData
} from '../../app/interfaces/admin.interface';

// Importar Chart.js
declare const Chart: any;

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css']
})

export class Admin implements OnInit, AfterViewInit {
  // Referencias a gráficos
  @ViewChild('pieChart') pieChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('barChart') barChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('lineChart') lineChartRef!: ElementRef<HTMLCanvasElement>;

  // Auth y Sesión - TIPADO
  loginForm!: FormGroup;
  loginError = '';
  isLoggedIn = false;
  adminData: AdminData | null = null;

  // Stats y Dashboard - TIPADO
  public _stats: DashboardMetrics | null = null;
  loadingStats = false;
  loadingAnalytics = false;
  loadingReports = false;
  loading = false;

  // Datos para alertas/auditoría
  auditLogs: any[] = [];

  // Reportes - TIPADO
  reporteFilters: ReportFilters = {
    tipoReporte: 'mascotas',
    fechaInicio: undefined,
    fechaFin: undefined,
    mascotaId: undefined
  };
  reporteData: ReporteData = { total: 0, data: [] };
  chartData: ChartData | null = null;

  // 📊 GETTERS PÚBLICOS PARA ESTADÍSTICAS
  getTotalUsuarios(): number {
    return this._stats?.resumen?.total_usuarios || 0;
  }

  getNuevosUsuarios30d(): number {
    return this._stats?.resumen?.usuarios_nuevos_30d || 0;
  }

  getTotalMascotas(): number {
    return this._stats?.resumen?.total_mascotas || 0;
  }

  getNuevasMascotas30d(): number {
    return this._stats?.resumen?.mascotas_nuevas_30d || 0;
  }

  getDispositivosActivos(): number {
    return this._stats?.resumen?.dispositivos_conectados || 0;
  }

  getAlertasUltimas24h(): number {
    return this._stats?.resumen?.alertas_24h || 0;
  }

  getUsuariosActivos(): number {
    return this._stats?.resumen?.usuarios_activos || 0;
  }

  getMascotasPorEspecie(): any[] {
    return this._stats?.graficos?.mascotas_por_especie || [];
  }

  getCrecimientoUsuarios(): string {
    const total = this.getTotalUsuarios();
    const nuevos = this.getNuevosUsuarios30d();
    if (total === 0) return '0.0';
    return ((nuevos * 100) / total).toFixed(1);
  }

  getPromedioMascotasPorUsuario(): string {
    const usuarios = this.getTotalUsuarios();
    const mascotas = this.getTotalMascotas();
    if (usuarios === 0) return '0.0';
    return (mascotas / usuarios).toFixed(1);
  }

  getStatsLoaded(): boolean {
    return this._stats !== null;
  }

  // Datos principales - SIMPLIFICADO
  usuarios: any[] = [];
  mascotas: any[] = [];
  alertas: any[] = [];
  alertasZona: any[] = [];
  alertasDispositivo: any[] = [];
  alertasFiltradas: any[] = [];

  // Ubicaciones y Dispositivos
  ubicacionesFiltradas: Array<any> = [];
  dispositivos: Array<any> = [];
  datosIoT: Array<any> = [];
  mascotasEnMapa: Array<any> = [];
  alertasGPS: Array<any> = [];
  gpsAnalytics: any = null;

  // Filtros
  filtroUbicacion = {
    zona: '',
    fechaInicio: null as Date | null,
    fechaFin: null as Date | null
  };
  filtroMascotas = { especie: '', estado: '' };
  filtroMapa = 'todos';
  filtroAlertas = 'todas';
  filtroReporte = 'hoy';

  // Paginación
  usuariosPage = 1;
  usuariosTotal = 0;
  mascotasPage = 1;
  mascotasTotal = 0;

  // Búsqueda y UI
  searchTerm = '';
  activeTab = 'dashboard';
  tiempoRealActivo = false;
  ultimaActualizacion = '2 minutos';

  // Formularios y modales - SIMPLIFICADO
  usuarioForm!: FormGroup;
  mascotaForm!: FormGroup;
  showUsuarioModal = false;
  showMascotaModal = false;
  editingUsuario: any = null;
  editingMascota: any = null;

  // Dashboard Charts
  dashboardCharts: any = {
    pieChart: null,
    barChart: null,
    lineChart: null
  };

  // 🔥 TIPOS DE REPORTES FUNCIONALES SEGÚN EL BACKEND - TIPADO
  tiposReporteFuncionales = [
    { value: 'mascotas', label: 'Reporte de Mascotas', description: 'Listado completo de mascotas registradas' },
    { value: 'auditoria', label: 'Reporte de Auditoría', description: 'Eventos y actividades del sistema' },
    { value: 'actividad', label: 'Reporte de Actividad', description: 'Actividad general del sistema' },
    { value: 'dispositivos', label: 'Reporte de Dispositivos', description: 'Estado y datos de dispositivos IoT' },
    { value: 'ubicaciones', label: 'Reporte de Ubicaciones', description: 'Historial de ubicaciones GPS' },
    { value: 'estadisticas', label: 'Reporte de Estadísticas', description: 'Métricas y estadísticas del sistema' }
  ];

  // Verificar si un tipo de reporte es funcional
  isTipoReporteFuncional(tipo: string): boolean {
    return this.tiposReporteFuncionales.some(t => t.value === tipo);
  }

  // Obtener descripción del tipo de reporte
  getDescripcionTipoReporte(tipo: string): string {
    const tipoObj = this.tiposReporteFuncionales.find(t => t.value === tipo);
    return tipoObj?.description || 'Tipo de reporte no válido';
  }

  // Obtener etiqueta del tipo de reporte
  getLabelTipoReporte(tipo: string): string {
    const tipoObj = this.tiposReporteFuncionales.find(t => t.value === tipo);
    return tipoObj?.label || tipo;
  }

  // Progreso y estado de reportes
  generatingReport = false;
  reportProgress = 0;
  currentOperation = '';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForms();
  }

  private initializeForms(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.usuarioForm = this.fb.group({
      nombre: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      telefono: ['']
    });

    this.mascotaForm = this.fb.group({
      nombre: ['', Validators.required],
      especie: ['', Validators.required],
      raza: [''],
      edad: [0, [Validators.required, Validators.min(0)]],
      propietario: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.checkAuthStatus();
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    if (this.isLoggedIn) {
      this.initializeCharts();
    }
  }

  // ==== AUTENTICACIÓN Y SESIÓN ====
  private async checkAuthStatus(): Promise<void> {
    const adminData = localStorage.getItem('adminSession');
    if (adminData) {
      try {
        this.adminData = JSON.parse(adminData);

        // 🔍 Debug: Verificar datos recuperados
        console.log('🔍 checkAuthStatus - Datos recuperados de localStorage:');
        console.log('📋 adminData:', this.adminData);
        console.log('🔑 tiene token:', !!this.adminData?.token);
        console.log('🎫 token preview:', this.adminData?.token ? this.adminData.token.substring(0, 30) + '...' : 'NO TOKEN');

        // Verificar que el token no esté vacío o undefined
        if (!this.adminData?.token || this.adminData.token.trim() === '') {
          console.log('❌ Token vacío o inválido, limpiando sesión');
          this.logout();
          return;
        }

        this.isLoggedIn = true;
        await this.loadDashboardData();

      } catch (error) {
        console.error('❌ Error parsing adminData from localStorage:', error);
        this.logout();
      }
    }
  }

  async login(): Promise<void> {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.loginError = '';

    try {
      const credentials = {
        email: this.loginForm.get('email')?.value,
        password: this.loginForm.get('password')?.value
      };

      // Use the specific admin login endpoint
      const response = await fetch('http://localhost:3000/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (response.ok) {
        // 🔍 Debug: Verificar respuesta del backend
        console.log('🔍 Respuesta completa del backend:', data);
        console.log('🔑 Token en respuesta:', !!data.token);
        console.log('👤 Admin en respuesta:', !!data.admin);

        // Asegurar que se capture el token correctamente
        const tokenToUse = data.token || data.admin?.token;

        if (!tokenToUse) {
          console.error('❌ No se recibió token del backend');
          this.loginError = 'Error: No se recibió token de autenticación';
          return;
        }

        this.adminData = {
          ...data.admin,
          token: tokenToUse
        };

        // 🔍 Debug: Verificar datos antes de guardar
        console.log('💾 Datos a guardar en localStorage:', this.adminData);
        console.log('🎫 Token final a guardar:', this.adminData?.token?.substring(0, 30) + '...');

        this.isLoggedIn = true;
        localStorage.setItem('adminSession', JSON.stringify(this.adminData));

        console.log('✅ Login exitoso. Token guardado:', !!this.adminData?.token);
        console.log('📊 Datos del admin:', {
          nombre: this.adminData?.nombre,
          email: this.adminData?.email,
          hasToken: !!this.adminData?.token,
          tokenPreview: this.adminData?.token ? this.adminData.token.substring(0, 20) + '...' : 'NO TOKEN'
        });
        console.log('💾 LocalStorage guardado:', JSON.stringify(this.adminData, null, 2));

        await this.loadDashboardData();
      } else {
        this.loginError = data.message || 'Credenciales inválidas o usuario no es administrador';
      }
    } catch (error) {
      this.loginError = 'Error de conexión con el servidor';
      console.error('Login error:', error);
    } finally {
      this.loading = false;
    }
  }

  logout(): void {
    this.isLoggedIn = false;
    this.adminData = null;
    localStorage.removeItem('adminSession');
    this.router.navigate(['/acceso']);
  }

  // ==== CARGA DE DATOS ====
  public async loadDashboardData(): Promise<void> {
    if (!this.isLoggedIn) {
      console.log('❌ No se puede cargar dashboard: usuario no logueado');
      return;
    }

    console.log('📊 Iniciando carga de datos del dashboard...');
    this.loadingStats = true;
    try {
      await Promise.all([
        this.loadDashboardMetrics(),
        this.loadUsers(),
        this.loadPets(),
        this.loadAuditLogs()
      ]);
      console.log('✅ Dashboard cargado exitosamente');

      // Forzar detección de cambios después de cargar todo
      this.cdr.detectChanges();

      // Inicializar los gráficos después de que se hayan cargado los datos
      setTimeout(() => {
        console.log('📈 Inicializando gráficos del dashboard...');
        this.initializeCharts();
      }, 300);

    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
    } finally {
      this.loadingStats = false;
    }
  }

  public async loadDashboardMetrics(): Promise<void> {
    try {
      console.log('📈 Cargando métricas del dashboard...');

      const response = await fetch('http://localhost:3000/api/admin/reportes/dashboard-metrics', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.adminData?.token || ''}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 Datos recibidos del backend:', data);

      // Usar directamente los datos del backend SIN MAPEO
      this._stats = data;

      // Actualizar chartData para los gráficos usando los datos del backend con estructura correcta
      this.chartData = {
        // Estructura para gráfico de pastel (mascotas por especie)
        mascotas: {
          perros: data.graficos?.mascotas_por_especie?.find((m: any) => m._id === 'Perro')?.count || 0,
          gatos: data.graficos?.mascotas_por_especie?.find((m: any) => m._id === 'Gato')?.count || 0,
          otros: data.graficos?.mascotas_por_especie?.filter((m: any) => !['Perro', 'Gato'].includes(m._id))?.reduce((sum: number, m: any) => sum + (m.count || 0), 0) || 0
        },
        // Estructura para gráfico de barras (usuarios activos por horario)
        usuariosActivos: {
          matutino: data.graficos?.actividad_por_periodo?.matutino || 0,
          vespertino: data.graficos?.actividad_por_periodo?.vespertino || 0,
          nocturno: data.graficos?.actividad_por_periodo?.nocturno || 0
        },
        // Estructura para gráfico de líneas (dispositivos activos por hora)
        dispositivosHora: data.graficos?.dispositivos_por_hora || Array(24).fill(0)
      };

      console.log('✅ Stats y chartData actualizados:', { stats: this._stats, chartData: this.chartData });
      this.cdr.detectChanges();

    } catch (error) {
      console.error('❌ Error loading dashboard metrics:', error);

      // Valores por defecto si falla la carga
      this._stats = {
        resumen: {
          operaciones_24h: 0,
          usuarios_activos_24h: 0,
          tasa_exito: '100',
          ubicaciones_gps_24h: 0,
          total_usuarios: 0,
          usuarios_nuevos_30d: 0,
          total_mascotas: 0,
          mascotas_nuevas_30d: 0,
          dispositivos_conectados: 0,
          usuarios_activos: 0
        },
        graficos: {
          actividad_por_hora: [],
          top_entidades: [],
          estados_sistema: [],
          mascotas_por_especie: [],
          actividad_por_periodo: { matutino: 0, vespertino: 0, nocturno: 0 },
          dispositivos_por_hora: Array(24).fill(0)
        },
        timestamp: new Date().toISOString(),
        processingTime: 0
      };

      this.chartData = {
        mascotas: { perros: 0, gatos: 0, otros: 0 },
        usuariosActivos: { matutino: 0, vespertino: 0, nocturno: 0 },
        dispositivosHora: Array(24).fill(0)
      };

      this.cdr.detectChanges();
    }
  }

  private async loadUsers(page: number = 1): Promise<void> {
    try {
      console.log('👥 Cargando usuarios...');
      const response = await fetch(
        `http://localhost:3000/api/admin/usuarios?page=${page}&limit=10&search=${this.searchTerm}`
      );
      console.log('📡 Respuesta usuarios:', response.status);
      if (!response.ok) throw new Error('Error loading users');
      const data = await response.json();
      console.log('👥 Usuarios cargados:', data.usuarios?.length || 0);
      this.usuarios = data.usuarios;
      this.usuariosTotal = data.total;
      this.usuariosPage = page;

      // Forzar detección de cambios
      this.cdr.detectChanges();
    } catch (error) {
      console.error('❌ Error loading users:', error);
    }
  }

  private async loadPets(page: number = 1): Promise<void> {
    try {
      console.log('🐕 Cargando mascotas...');
      const response = await fetch(
        `http://localhost:3000/api/admin/mascotas?page=${page}&limit=10&search=${this.searchTerm}`
      );
      console.log('📡 Respuesta mascotas:', response.status);
      if (!response.ok) throw new Error('Error loading pets');
      const data = await response.json();
      console.log('🐕 Mascotas cargadas:', data.mascotas?.length || 0);
      this.mascotas = data.mascotas;
      this.mascotasTotal = data.total;
      this.mascotasPage = page;

      // Forzar detección de cambios
      this.cdr.detectChanges();
    } catch (error) {
      console.error('❌ Error loading pets:', error);
    }
  }

  public async loadAlerts(): Promise<void> {
    try {
      console.log('🚨 Cargando todas las alertas de auditoría...');

      // Cargar eventos críticos del sistema
      const criticalResponse = await fetch('http://localhost:3000/api/admin/reportes/critical-events', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.adminData?.token || ''}`
        }
      });

      // Cargar eventos de auditoría general
      const auditResponse = await fetch('http://localhost:3000/api/admin/auditoria', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.adminData?.token || ''}`
        }
      });

      console.log('📡 Respuesta de eventos críticos:', criticalResponse.status);
      console.log('� Respuesta de auditoría:', auditResponse.status);

      this.alertas = [];

      // Procesar eventos críticos si la respuesta es exitosa
      if (criticalResponse.ok) {
        const criticalData = await criticalResponse.json();
        console.log('🚨 Eventos críticos recibidos:', criticalData);

        // Agregar errores críticos
        if (criticalData.errores_criticos && Array.isArray(criticalData.errores_criticos)) {
          this.alertas.push(...criticalData.errores_criticos.map((error: any) => ({
            tipo: 'error',
            mensaje: error.mensaje || 'Error crítico detectado',
            fecha: error.fecha || error.timestamp || new Date().toISOString(),
            usuario: error.actor || error.usuario,
            dispositivo: error.entidad,
            icono: '🔴',
            titulo: 'Error Crítico'
          })));
        }

        // Agregar actividad anómala
        if (criticalData.actividad_anomala && Array.isArray(criticalData.actividad_anomala)) {
          this.alertas.push(...criticalData.actividad_anomala.map((anomalia: any) => ({
            tipo: 'warning',
            mensaje: anomalia.mensaje || 'Actividad anómala detectada',
            fecha: anomalia.fecha || anomalia.timestamp || new Date().toISOString(),
            usuario: anomalia.actor || anomalia.usuario,
            dispositivo: anomalia.entidad,
            icono: '�',
            titulo: 'Actividad Anómala'
          })));
        }

        // Agregar dispositivos sin GPS
        if (criticalData.dispositivos_sin_gps && Array.isArray(criticalData.dispositivos_sin_gps)) {
          this.alertas.push(...criticalData.dispositivos_sin_gps.map((dispositivo: any) => ({
            tipo: 'info',
            mensaje: dispositivo.mensaje || 'Dispositivo sin conexión GPS',
            fecha: dispositivo.fecha || dispositivo.timestamp || new Date().toISOString(),
            dispositivo: dispositivo.entidad || dispositivo.dispositivo,
            icono: '�',
            titulo: 'GPS Desconectado'
          })));
        }
      }

      // Procesar eventos de auditoría general si la respuesta es exitosa
      if (auditResponse.ok) {
        const auditData = await auditResponse.json();
        console.log('📋 Eventos de auditoría recibidos:', auditData);

        if (auditData.eventos && Array.isArray(auditData.eventos)) {
          // Agregar eventos de auditoría como alertas informativas
          this.alertas.push(...auditData.eventos.slice(0, 20).map((evento: any) => ({
            tipo: this.getAlertTypeFromAction(evento.accion),
            mensaje: `${evento.accion}: ${evento.entidad || 'Sistema'}`,
            fecha: evento.fecha || evento.timestamp || new Date().toISOString(),
            usuario: evento.actor || 'Sistema',
            dispositivo: evento.entidad,
            icono: this.getAlertIconFromAction(evento.accion),
            titulo: this.getAlertTitleFromAction(evento.accion)
          })));
        }
      }

      // Ordenar alertas por fecha (más recientes primero)
      this.alertas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      this.processAlerts();
      console.log('✅ Total de alertas cargadas:', this.alertas.length);

      // Forzar detección de cambios
      this.cdr.detectChanges();
    } catch (error) {
      console.error('❌ Error loading alerts:', error);
      this.alertas = []; // En caso de error, asegurar que sea un array vacío
      this.processAlerts(); // Procesar incluso si hay error para inicializar las propiedades

      // Forzar detección de cambios incluso en caso de error
      this.cdr.detectChanges();
    }
  }

  // Métodos auxiliares para mapear eventos de auditoría a alertas
  private getAlertTypeFromAction(accion: string): string {
    if (accion?.includes('eliminar') || accion?.includes('delete')) return 'error';
    if (accion?.includes('actualizar') || accion?.includes('update')) return 'warning';
    if (accion?.includes('crear') || accion?.includes('create')) return 'info';
    if (accion?.includes('login') || accion?.includes('logout')) return 'info';
    return 'info';
  }

  private getAlertIconFromAction(accion: string): string {
    if (accion?.includes('eliminar') || accion?.includes('delete')) return '🗑️';
    if (accion?.includes('actualizar') || accion?.includes('update')) return '✏️';
    if (accion?.includes('crear') || accion?.includes('create')) return '➕';
    if (accion?.includes('login')) return '🔐';
    if (accion?.includes('logout')) return '🚪';
    return '📝';
  }

  private getAlertTitleFromAction(accion: string): string {
    if (accion?.includes('eliminar') || accion?.includes('delete')) return 'Elemento Eliminado';
    if (accion?.includes('actualizar') || accion?.includes('update')) return 'Actualización';
    if (accion?.includes('crear') || accion?.includes('create')) return 'Nuevo Registro';
    if (accion?.includes('login')) return 'Inicio de Sesión';
    if (accion?.includes('logout')) return 'Cierre de Sesión';
    return 'Evento del Sistema';
  }

  private processAlerts(): void {
    this.alertasZona = this.alertas.filter(a => a.tipo === 'zona');
    this.alertasDispositivo = this.alertas.filter(a => a.tipo === 'dispositivo');
    this.alertasFiltradas = this.alertas;
  }

  // Métodos helper para el template
  public getAlertasPorTipo(tipo: string): number {
    if (!this.alertas || !Array.isArray(this.alertas)) {
      return 0;
    }
    return this.alertas.filter(a => a.tipo === tipo).length;
  }

  public getAlertasErrores(): number {
    return this.getAlertasPorTipo('error');
  }

  public getAlertasAdvertencias(): number {
    return this.getAlertasPorTipo('warning');
  }

  public getAlertasInfo(): number {
    return this.getAlertasPorTipo('info');
  }

  // ==== GESTIÓN DE USUARIOS ====
  async saveUsuario(): Promise<void> {
    if (this.usuarioForm.invalid) return;

    this.loading = true;
    try {
      const userData = this.usuarioForm.value;
      const url = this.editingUsuario
        ? `http://localhost:3000/api/admin/usuarios/${this.editingUsuario._id}`
        : 'http://localhost:3000/api/admin/usuarios';

      const response = await fetch(url, {
        method: this.editingUsuario ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      this.closeUsuarioModal();
      await this.loadUsers(this.usuariosPage);
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error: ' + (error as Error).message);
    } finally {
      this.loading = false;
    }
  }

  async deleteUsuario(id: string): Promise<void> {
    if (!confirm('¿Está seguro de eliminar este usuario?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/admin/usuarios/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      await this.loadUsers(this.usuariosPage);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error: ' + (error as Error).message);
    }
  }

  openUsuarioModal(usuario?: any): void {
    this.editingUsuario = usuario || null;

    if (usuario) {
      this.usuarioForm.patchValue({
        nombre: usuario.nombre,
        email: usuario.email,
        telefono: usuario.telefono || ''
      });
      this.usuarioForm.get('password')?.clearValidators();
      this.usuarioForm.get('password')?.updateValueAndValidity();
    } else {
      this.usuarioForm.reset();
      this.usuarioForm.get('password')?.setValidators([
        Validators.required,
        Validators.minLength(6)
      ]);
      this.usuarioForm.get('password')?.updateValueAndValidity();
    }

    this.showUsuarioModal = true;
  }

  closeUsuarioModal(): void {
    this.showUsuarioModal = false;
    this.editingUsuario = null;
    this.usuarioForm.reset();
  }

  // ==== GESTIÓN DE MASCOTAS ====
  async saveMascota(): Promise<void> {
    if (this.mascotaForm.invalid) return;

    this.loading = true;
    try {
      const mascotaData = this.mascotaForm.value;
      const url = this.editingMascota
        ? `http://localhost:3000/api/admin/mascotas/${this.editingMascota._id}`
        : 'http://localhost:3000/api/admin/mascotas';

      const response = await fetch(url, {
        method: this.editingMascota ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mascotaData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      this.closeMascotaModal();
      await this.loadPets(this.mascotasPage);
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error saving pet:', error);
      alert('Error: ' + (error as Error).message);
    } finally {
      this.loading = false;
    }
  }

  async deleteMascota(id: string): Promise<void> {
    if (!confirm('¿Está seguro de eliminar esta mascota?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/admin/mascotas/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      await this.loadPets(this.mascotasPage);
    } catch (error) {
      console.error('Error deleting pet:', error);
      alert('Error: ' + (error as Error).message);
    }
  }

  openMascotaModal(mascota?: any): void {
    this.editingMascota = mascota || null;

    if (mascota) {
      this.mascotaForm.patchValue({
        nombre: mascota.nombre,
        especie: mascota.especie,
        raza: mascota.raza || '',
        edad: mascota.edad || 0,
        propietario: mascota.propietario
      });
    } else {
      this.mascotaForm.reset();
    }

    this.showMascotaModal = true;
  }

  closeMascotaModal(): void {
    this.showMascotaModal = false;
    this.editingMascota = null;
    this.mascotaForm.reset();
  }

  // ==== GESTIÓN DE REPORTES Y GRÁFICOS ====
  private initializeCharts(): void {
    if (!(window as any).Chart) {
      this.loadChartJS().then(() => {
        this.createCharts();
      });
    } else {
      this.createCharts();
    }
  }

  // Nueva función para cargar estadísticas de rendimiento
  async loadPerformanceStats(): Promise<void> {
    try {
      const response = await fetch('http://localhost:3000/api/admin/reportes/performance-stats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.adminData?.token || ''}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      console.log('Estadísticas de rendimiento:', data);

      // Aquí puedes procesar las estadísticas de rendimiento según necesites
      // Por ejemplo, mostrar los endpoints más lentos, carga por hora, etc.

    } catch (error) {
      console.error('Error loading performance stats:', error);
    }
  }

  private async loadChartJS(): Promise<void> {
    try {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      return new Promise<void>((resolve) => {
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    } catch (error) {
      console.error('Error loading Chart.js:', error);
    }
  }

  private createCharts(): void {
    this.createPieChart();
    this.createBarChart();
    this.createLineChart();
  }

  private createPieChart(): void {
    if (!this.pieChartRef?.nativeElement || !this.chartData) return;

    const ctx = this.pieChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.dashboardCharts.pieChart?.destroy();

    // Usar la nueva estructura de datos para mascotas
    const mascotas = this.chartData.mascotas || { perros: 0, gatos: 0, otros: 0 };
    const total = mascotas.perros + mascotas.gatos + mascotas.otros;

    const data = {
      labels: ['Perros', 'Gatos', 'Otros'],
      datasets: [{
        data: total > 0 ? [mascotas.perros, mascotas.gatos, mascotas.otros] : [1],
        backgroundColor: total > 0 ? ['#3b82f6', '#ef4444', '#10b981'] : ['#9ca3af'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };

    // Si no hay datos, mostrar etiqueta "Sin datos"
    if (total === 0) {
      data.labels = ['Sin datos'];
    }

    this.dashboardCharts.pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 40
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            align: 'center',
            labels: {
              padding: 15,
              boxWidth: 12,
              boxHeight: 12,
              font: {
                size: 11,
                family: "'Inter', sans-serif"
              },
              color: '#334155',
              usePointStyle: true,
              generateLabels: (chart: any) => {
                if (total === 0) {
                  return [{
                    text: 'Sin datos disponibles',
                    fillStyle: '#9ca3af',
                    strokeStyle: '#ffffff',
                    lineWidth: 2,
                    hidden: false,
                    index: 0,
                    pointStyle: 'circle'
                  }];
                }
                return Chart.defaults.plugins.legend.labels.generateLabels(chart);
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                if (total === 0) return 'Sin datos disponibles';
                const label = context.label || '';
                const value = context.parsed || 0;
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  private createBarChart(): void {
    if (!this.barChartRef?.nativeElement || !this.chartData) return;

    const ctx = this.barChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.dashboardCharts.barChart?.destroy();

    // Usar los datos de usuarios activos por períodos (mañana, tarde, noche)
    const usuariosData = this.chartData.usuariosActivos || { matutino: 0, vespertino: 0, nocturno: 0 };

    const data = {
      labels: ['Matutino (6-12h)', 'Vespertino (12-20h)', 'Nocturno (20-6h)'],
      datasets: [{
        label: 'Usuarios Activos por Período',
        data: [usuariosData.matutino, usuariosData.vespertino, usuariosData.nocturno],
        backgroundColor: [
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)'
        ],
        borderColor: [
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)'
        ],
        borderWidth: 1,
        borderRadius: 4
      }]
    };

    this.dashboardCharts.barChart = new Chart(ctx, {
      type: 'bar',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Número de Usuarios' },
            ticks: {
              stepSize: 1
            }
          },
          x: {
            title: { display: true, text: 'Período del Día' },
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const periodo = context.label;
                const usuarios = context.parsed.y;
                return `${periodo}: ${usuarios} usuarios activos`;
              }
            }
          }
        }
      }
    });
  }

  private createLineChart(): void {
    if (!this.lineChartRef?.nativeElement || !this.chartData) return;

    const ctx = this.lineChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.dashboardCharts.lineChart?.destroy();

    // Generar etiquetas para las 24 horas del día
    const horasLabels = Array.from({ length: 24 }, (_, i) => {
      const hora = i.toString().padStart(2, '0');
      return `${hora}:00`;
    });

    // Usar los datos de actividad por dispositivos (24 valores)
    const actividadData = this.chartData.dispositivosHora || this.chartData.actividadDispositivos || new Array(24).fill(0);

    const data = {
      labels: horasLabels,
      datasets: [{
        label: 'Actividad de Dispositivos por Hora',
        data: actividadData,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4
      }]
    };

    this.dashboardCharts.lineChart = new Chart(ctx, {
      type: 'line',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Número de Actividades' },
            ticks: {
              stepSize: 1
            }
          },
          x: {
            title: { display: true, text: 'Hora del Día' }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const hora = context.label;
                const actividad = context.parsed.y;
                return `${hora}: ${actividad} actividades`;
              }
            }
          }
        }
      }
    });
  }

  async loadDashboardCharts(): Promise<void> {
    this.loading = true;
    try {
      console.log('📈 Cargando datos específicos para gráficos del dashboard...');

      // Obtener datos específicos para los 3 gráficos desde el backend
      const [mascotasResponse, actividadResponse, usuariosResponse] = await Promise.all([
        // 1. Datos para gráfico de pastel: Distribución de mascotas por tipo
        fetch('http://localhost:3000/api/admin/reportes/generate-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.adminData?.token || ''}`
          },
          body: JSON.stringify({
            tipoReporte: 'mascotas'
          })
        }),

        // 2. Datos para actividad de dispositivos por hora (últimas 24h)
        fetch('http://localhost:3000/api/admin/reportes/dashboard-metrics', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.adminData?.token || ''}`
          }
        }),

        // 3. Datos para usuarios activos por horario (últimos 7 días)
        fetch('http://localhost:3000/api/admin/reportes/generate-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.adminData?.token || ''}`
          },
          body: JSON.stringify({
            tipoReporte: 'actividad'
          })
        })
      ]);

      const mascotasData = await mascotasResponse.json();
      const actividadData = await actividadResponse.json();
      const usuariosData = await usuariosResponse.json();

      console.log('📊 Datos recibidos para gráficos:', {
        mascotas: mascotasData.total || 0,
        actividad: actividadData.graficos?.actividad_por_hora?.length || 0,
        usuarios: usuariosData.total || 0
      });

      // Procesar datos para cada gráfico
      this.processChartData(mascotasData, actividadData, usuariosData);

      // Asegurar que Chart.js esté cargado
      if (!(window as any).Chart) {
        await this.loadChartJS();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Crear los gráficos después de procesar los datos
      setTimeout(() => {
        this.createCharts();
      }, 200);

    } catch (error: any) {
      console.error('❌ Error cargando datos de gráficos:', error);
      // Si hay error, crear gráficos con datos vacíos
      this.chartData = {
        mascotas: { perros: 0, gatos: 0, otros: 0 },
        actividadDispositivos: Array(24).fill(0),
        usuariosActivos: { matutino: 0, vespertino: 0, nocturno: 0 }
      };

      if (!(window as any).Chart) {
        await this.loadChartJS();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setTimeout(() => {
        this.createCharts();
      }, 200);
    } finally {
      this.loading = false;
    }
  }

  private processChartData(mascotasData: any, actividadData: any, usuariosData: any): void {
    // 1. Procesar distribución de mascotas por tipo
    const mascotasPorTipo = { perros: 0, gatos: 0, otros: 0 };
    if (mascotasData?.mascotas?.length > 0) {
      mascotasData.mascotas.forEach((mascota: any) => {
        const especie = mascota.especie?.toLowerCase();
        if (especie === 'perro') {
          mascotasPorTipo.perros++;
        } else if (especie === 'gato') {
          mascotasPorTipo.gatos++;
        } else {
          mascotasPorTipo.otros++;
        }
      });
    }

    // 2. Procesar actividad de dispositivos por hora (últimas 24h)
    const actividadPorHora = Array(24).fill(0);
    if (actividadData?.graficos?.actividad_por_hora?.length > 0) {
      actividadData.graficos.actividad_por_hora.forEach((item: any) => {
        const hora = item._id || item.hora || 0;
        const operaciones = item.operaciones || item.count || 0;
        if (hora >= 0 && hora < 24) {
          actividadPorHora[hora] = operaciones;
        }
      });
    }

    // 3. Procesar usuarios activos por horario (matutino: 6-12, vespertino: 12-20, nocturno: 20-6)
    const usuariosPorHorario = { matutino: 0, vespertino: 0, nocturno: 0 };
    if (usuariosData?.actividad?.length > 0) {
      usuariosData.actividad.forEach((item: any) => {
        const hora = item._id?.hora || 0;
        const usuarios = item.usuarios_count || 0;

        if (hora >= 6 && hora < 12) {
          usuariosPorHorario.matutino += usuarios;
        } else if (hora >= 12 && hora < 20) {
          usuariosPorHorario.vespertino += usuarios;
        } else {
          usuariosPorHorario.nocturno += usuarios;
        }
      });
    }

    // Asignar datos procesados
    this.chartData = {
      mascotas: mascotasPorTipo,
      actividadDispositivos: actividadPorHora,
      usuariosActivos: usuariosPorHorario
    };

    console.log('📈 Datos procesados para gráficos:', this.chartData);
  }

  // ==== GESTIÓN DE REPORTES ====
  async generateReport(): Promise<void> {
    if (this.generatingReport) return;

    // 🔍 Validar que el tipo de reporte sea funcional
    if (!this.isTipoReporteFuncional(this.reporteFilters.tipoReporte)) {
      alert(`El tipo de reporte "${this.reporteFilters.tipoReporte}" no está disponible. Por favor seleccione uno de los tipos funcionales.`);
      return;
    }

    // 🔍 Debug: Verificar token antes de la petición
    console.log('🔍 Debug generateReport - Estado del token:');
    console.log('📋 adminData:', this.adminData);
    console.log('🔑 token disponible:', !!this.adminData?.token);
    console.log('🎫 token preview:', this.adminData?.token ? this.adminData.token.substring(0, 30) + '...' : 'NO TOKEN');

    // Verificar localStorage también
    const storedData = localStorage.getItem('adminSession');
    console.log('💾 localStorage raw:', storedData);
    if (storedData) {
      const parsed = JSON.parse(storedData);
      console.log('📦 localStorage parsed token:', !!parsed.token);
      console.log('🎫 localStorage token preview:', parsed.token ? parsed.token.substring(0, 30) + '...' : 'NO TOKEN');
    }

    this.generatingReport = true;
    this.reportProgress = 0;
    this.currentOperation = `Generando ${this.getLabelTipoReporte(this.reporteFilters.tipoReporte)}...`;
    this.reporteData = { total: 0, data: [] };

    try {
      this.reportProgress = 20;
      this.cdr.detectChanges();

      // Preparar fechas correctamente (pueden venir como strings del HTML)
      let fechaInicio = null;
      let fechaFin = null;

      if (this.reporteFilters.fechaInicio) {
        fechaInicio = typeof this.reporteFilters.fechaInicio === 'string'
          ? new Date(this.reporteFilters.fechaInicio).toISOString()
          : this.reporteFilters.fechaInicio.toISOString();
      }

      if (this.reporteFilters.fechaFin) {
        fechaFin = typeof this.reporteFilters.fechaFin === 'string'
          ? new Date(this.reporteFilters.fechaFin).toISOString()
          : this.reporteFilters.fechaFin.toISOString();
      }

      // 🔍 Debug: Verificar headers antes del envío
      const authHeader = `Bearer ${this.adminData?.token || ''}`;
      console.log('📤 Header Authorization a enviar:', authHeader.substring(0, 50) + '...');

      // Usar directamente el endpoint del backend sin mapeo complejo
      const response = await fetch('http://localhost:3000/api/admin/reportes/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          tipoReporte: this.reporteFilters.tipoReporte,
          fechaInicio: fechaInicio,
          fechaFin: fechaFin,
          mascotaId: this.reporteFilters.mascotaId
        })
      });

      this.reportProgress = 60;
      this.cdr.detectChanges();

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      console.log('📋 Datos del reporte recibidos del backend:', data);
      console.log('🔍 Estructura completa del reporte:', JSON.stringify(data, null, 2));
      console.log('📊 data.total:', data.total);
      console.log('📊 data.data?.length:', data.data?.length);

      // Usar directamente los datos del backend
      // El backend devuelve diferentes campos según el tipo de reporte
      let reportData = [];

      console.log('🔍 Analizando campos del reporte:');
      console.log('🔍 data.mascotas existe:', !!data.mascotas, 'length:', data.mascotas?.length);
      console.log('🔍 data.usuarios existe:', !!data.usuarios, 'length:', data.usuarios?.length);
      console.log('🔍 data.dispositivos existe:', !!data.dispositivos, 'length:', data.dispositivos?.length);
      console.log('🔍 data.ubicaciones existe:', !!data.ubicaciones, 'length:', data.ubicaciones?.length);
      console.log('🔍 data.data existe:', !!data.data, 'length:', data.data?.length);

      if (data.mascotas) {
        reportData = data.mascotas;
        console.log('✅ Usando data.mascotas, length:', reportData.length);
      } else if (data.auditoria) {
        reportData = data.auditoria;
        console.log('✅ Usando data.auditoria, length:', reportData.length);
      } else if (data.dispositivos) {
        reportData = data.dispositivos;
        console.log('✅ Usando data.dispositivos, length:', reportData.length);
      } else if (data.ubicaciones) {
        reportData = data.ubicaciones;
        console.log('✅ Usando data.ubicaciones, length:', reportData.length);
      } else if (data.actividad) {
        reportData = data.actividad;
        console.log('✅ Usando data.actividad, length:', reportData.length);
      } else if (data.estadisticas) {
        reportData = data.estadisticas;
        console.log('✅ Usando data.estadisticas, length:', reportData.length);
      } else {
        console.log('❌ No se encontró ningún campo de datos válido');
      }

      this.reporteData = {
        total: data.total || reportData.length || 0,
        data: reportData,
        ubicaciones: data.ubicaciones,
        alertas: data.alertas
      };

      console.log('💾 reporteData final asignado:', this.reporteData);
      console.log('🎯 reporteData.total final:', this.reporteData.total);
      console.log('📋 reporteData.data.length final:', this.reporteData.data.length);

      this.reportProgress = 100;
      this.currentOperation = `Reporte generado: ${this.reporteData.total} registros`;
      this.cdr.detectChanges();

    } catch (error: any) {
      console.error('❌ Error al generar reporte:', error);
      this.currentOperation = `Error: ${error.message}`;
      this.reportProgress = 0;
      alert('Error al generar el reporte: ' + error.message);
    } finally {
      this.generatingReport = false;
      this.cdr.detectChanges();
    }
  }

  async exportToPDF(): Promise<void> {
    console.log('🔍 Debug exportToPDF - Estado del reporte:');
    console.log('📊 reporteData:', this.reporteData);
    console.log('📊 reporteData.total:', this.reporteData.total);
    console.log('📊 reporteData.data.length:', this.reporteData.data?.length);
    console.log('✅ Condición total === 0:', this.reporteData.total === 0);

    if (this.reporteData.total === 0) {
      alert('Primero debe generar un reporte');
      return;
    }

    this.loading = true;
    try {
      // Preparar el request usando la misma estructura que Excel
      const requestData: ExcelExportRequest = {
        data: this.reporteData.data || [],
        tipo: this.reporteFilters.tipoReporte,
        fechaInicio: this.reporteFilters.fechaInicio ?
          (typeof this.reporteFilters.fechaInicio === 'string' ? this.reporteFilters.fechaInicio : this.reporteFilters.fechaInicio.toISOString()) : undefined,
        fechaFin: this.reporteFilters.fechaFin ?
          (typeof this.reporteFilters.fechaFin === 'string' ? this.reporteFilters.fechaFin : this.reporteFilters.fechaFin.toISOString()) : undefined,
        mascota: this.reporteFilters.mascotaId || undefined
      };

      console.log('📦 Enviando request para PDF:', requestData);

      const response = await fetch('http://localhost:3000/api/admin/reportes/export-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.adminData?.token || ''}`
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error del servidor: ${response.status}`);
      }

      // Descargar el archivo PDF generado por el backend
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-onichip-${this.reporteFilters.tipoReporte}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('✅ PDF exportado exitosamente');

    } catch (error: any) {
      console.error('❌ Error al exportar a PDF:', error);
      alert('Error al exportar a PDF: ' + (error.message || error));
    } finally {
      this.loading = false;
    }
  }

  async exportToExcel(): Promise<void> {
    if (this.reporteData.total === 0) {
      alert('Primero debe generar un reporte');
      return;
    }

    this.loading = true;
    try {
      console.log('📤 Exportando Excel usando función principal del backend...');

      // Preparar datos usando la nueva estructura de la función principal
      const requestBody = {
        data: this.reporteData.data, // Array de datos ya generado por generateReport
        tipo: this.reporteFilters.tipoReporte, // Tipo de reporte para nombre de hoja
        fechaInicio: this.reporteFilters.fechaInicio ?
          (typeof this.reporteFilters.fechaInicio === 'string' ? this.reporteFilters.fechaInicio : this.reporteFilters.fechaInicio.toISOString().split('T')[0]) : undefined,
        fechaFin: this.reporteFilters.fechaFin ?
          (typeof this.reporteFilters.fechaFin === 'string' ? this.reporteFilters.fechaFin : this.reporteFilters.fechaFin.toISOString().split('T')[0]) : undefined,
        mascota: this.reporteFilters.mascotaId || undefined
      };

      console.log('📋 Enviando datos al backend:', {
        dataLength: requestBody.data?.length,
        tipo: requestBody.tipo,
        filtros: {
          fechaInicio: requestBody.fechaInicio,
          fechaFin: requestBody.fechaFin,
          mascota: requestBody.mascota
        }
      });

      // Usar el endpoint refactorizado de generate-excel
      const response = await fetch('http://localhost:3000/api/admin/reportes/generate-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.adminData?.token || ''}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error del servidor: ${response.status}`);
      }

      // Descargar el archivo Excel generado por el backend
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-${this.reporteFilters.tipoReporte}-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('✅ Excel generado exitosamente usando función principal del backend');
    } catch (error: any) {
      console.error('❌ Error al exportar Excel:', error);
      alert('Error al generar Excel: ' + error.message);
    } finally {
      this.loading = false;
    }
  }

  // ==== NAVEGACIÓN Y UI ====
  setActiveTab(tab: string): void {
    if (this.loading) return;

    console.log(`🔄 Cambiando a tab: ${tab}`);
    this.activeTab = tab;
    this.searchTerm = '';

    switch (tab) {
      case 'dashboard':
        this.loadDashboardData().then(() => {
          // Inicializar gráficos después de cargar los datos
          setTimeout(() => {
            this.initializeCharts();
            this.loadDashboardCharts(); // Cargar datos específicos para gráficos
          }, 500);
        });
        break;
      case 'usuarios':
        this.loadUsers();
        break;
      case 'mascotas':
        this.loadPets();
        break;
      case 'reportes':
        // Los reportes se generan bajo demanda, no necesitan carga inicial
        break;
      case 'alertas':
        this.loadAlerts();
        break;
      default:
        this.loadDashboardData();
    }

    this.cdr.detectChanges();
  }

  getShortId(id: string): string {
    return id.slice(-6);
  }

  // Slice data for preview
  getReporteDataSlice(limit: number = 10): any[] {
    if (!this.reporteData?.data || !Array.isArray(this.reporteData.data)) {
      return [];
    }
    return this.reporteData.data.slice(0, limit);
  }

  // Obtiene dinámicamente los encabezados de la tabla de vista previa según las claves del primer objeto
  getPreviewHeaders(): string[] {
    if (!this.reporteData?.data || this.reporteData.data.length === 0) {
      return [];
    }
    return Object.keys(this.reporteData.data[0]);
  }

  getUbicacionesSlice(limit: number = 10): any[] {
    if (!this.reporteData?.ubicaciones || !Array.isArray(this.reporteData.ubicaciones)) {
      return [];
    }
    return this.reporteData.ubicaciones.slice(0, limit);
  }

  getAlertasSlice(limit: number = 10): any[] {
    if (!this.reporteData?.alertas || !Array.isArray(this.reporteData.alertas)) {
      return [];
    }
    return this.reporteData.alertas.slice(0, limit);
  }

  getPropietarioNombre(propietario: string | { nombre: string; [key: string]: any }): string {
    if (typeof propietario === 'string') {
      return propietario;
    }
    return propietario?.nombre || 'N/A';
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getAlertClass(tipo: string | undefined): string {
    const classes = {
      'error': 'bg-red-100 text-red-800',
      'warning': 'bg-yellow-100 text-yellow-800',
      'info': 'bg-blue-100 text-blue-800',
      'success': 'bg-green-100 text-green-800'
    };
    return tipo ? (classes[tipo as keyof typeof classes] || classes.info) : classes.info;
  }

  onSearch(): void {
    if (this.activeTab === 'usuarios') {
      this.loadUsers(1);
    } else if (this.activeTab === 'mascotas') {
      this.loadPets(1);
    }
  }

  prevPage(): void {
    if (this.activeTab === 'usuarios' && this.usuariosPage > 1) {
      this.loadUsers(this.usuariosPage - 1);
    } else if (this.activeTab === 'mascotas' && this.mascotasPage > 1) {
      this.loadPets(this.mascotasPage - 1);
    }
  }

  // Contadores para eventos de auditoría
  getTotalEventosExitosos(): number {
    return this.auditLogs.filter(log =>
      log.accion && (log.accion.includes('Login') || log.accion.includes('Registro') || log.accion.includes('Crear'))
    ).length;
  }

  getTotalEventosAdvertencia(): number {
    return this.auditLogs.filter(log =>
      log.accion && (log.accion.includes('Modificar') || log.accion.includes('Actualizar'))
    ).length;
  }

  getTotalEventosError(): number {
    return this.auditLogs.filter(log =>
      log.accion && (log.accion.includes('Error') || log.accion.includes('Falló'))
    ).length;
  }

  // ==== GESTIÓN DE ALERTAS (AUDITORÍA) ====
  async loadAuditLogs(): Promise<void> {
    try {
      console.log('📋 Cargando logs de auditoría...');

      const response = await fetch(`http://localhost:3000/api/admin/auditoria`, {
        headers: {
          'Authorization': `Bearer ${this.adminData?.token || ''}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error al cargar auditoría: ${response.status}`);
      }

      const data = await response.json();
      this.auditLogs = data.registros || [];

      console.log(`✅ ${this.auditLogs.length} logs de auditoría cargados`);
      this.cdr.detectChanges();
    } catch (error: any) {
      console.error('❌ Error al cargar auditoría:', error);
      this.auditLogs = [];
      this.cdr.detectChanges();
    }
  }

  // ==== MÉTODO DE ACTUALIZACIÓN ====
  async refreshData(): Promise<void> {
    console.log('🔄 Actualizando datos del dashboard...');

    // Recargar datos según la pestaña activa
    switch (this.activeTab) {
      case 'dashboard':
        await this.loadDashboardData();
        setTimeout(() => this.initializeCharts(), 500);
        break;
      case 'usuarios':
        await this.loadUsers(1);
        break;
      case 'mascotas':
        await this.loadPets(1);
        break;
      case 'reportes':
        if (this.reporteData?.data?.length) {
          await this.generateReport();
        }
        break;
      case 'alertas':
        await this.loadAuditLogs();
        break;
    }

    console.log('✅ Datos actualizados correctamente');
  }

  // ==== MÉTODOS DE EXPORTACIÓN ====
  async exportReport(format: string): Promise<void> {
    if (!this.reporteData?.data?.length) {
      alert('No hay datos para exportar. Genera un reporte primero.');
      return;
    }

    try {
      console.log(`📥 Exportando reporte en formato ${format}...`);

      const filename = `reporte_${format}_${new Date().toISOString().split('T')[0]}`;
      const data = this.reporteData.data;

      if (format === 'json') {
        const json = JSON.stringify(data, null, 2);
        this.downloadFile(json, `${filename}.json`, 'application/json');
      } else if (format === 'csv') {
        const csv = this.convertToCSV(data);
        this.downloadFile(csv, `${filename}.csv`, 'text/csv');
      }

      console.log(`✅ Reporte exportado exitosamente en formato ${format}`);
    } catch (error: any) {
      console.error('❌ Error al exportar reporte:', error);
      alert('Error al exportar el reporte: ' + error.message);
    }
  }

  private convertToCSV(data: any[]): string {
    if (!data.length) return '';

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(field => {
          const value = row[field];
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
        }).join(',')
      )
    ].join('\n');

    return csvContent;
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  nextPage(): void {
    if (this.activeTab === 'usuarios') {
      this.loadUsers(this.usuariosPage + 1);
    } else if (this.activeTab === 'mascotas') {
      this.loadPets(this.mascotasPage + 1);
    }
  }
}
