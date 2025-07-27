import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../app/services/auth.service';
import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import * as ExcelJS from 'exceljs';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

// Importar Chart.js
declare const Chart: any;

// Define interfaces for the component
interface AdminData {
  _id?: string;
  nombre?: string;
  email?: string;
  role?: string;
  rol?: string; // Añadido para compatibilidad con el template
  token?: string;
  createdAt?: string;
  lastLogin?: string;
}

interface ReporteFilters {
  tipoReporte: string;
  fechaInicio?: Date;
  fechaFin?: Date;
  mascotaId?: string;
}

interface ChartData {
  perros?: number;
  gatos?: number;
  otros?: number;
  actividadMensual?: number[];
  dispositivosActivos?: number[];
  [key: string]: any;
}

interface DashboardStats {
  totalUsuarios: number;
  nuevosUsuarios30d: number;
  totalMascotas: number;
  nuevasMascotas30d: number;
  totalDispositivos: number;
  dispositivosActivos: number;
  alertasUltimas24h: number;
  alertasPorTipo: any[];
  usuariosActivos: number;
  mascotasPorEspecie: any[];
  mascotasRegistradas: number;
  [key: string]: any;
}

interface DashboardCharts {
  pieChart: any;
  barChart: any;
  lineChart: any;
  [key: string]: any;
}

interface Usuario {
  _id: string;
  nombre: string;
  email: string;
  telefono?: string;
  createdAt?: string;
  lastLogin?: string;
  fechaRegistro?: string;
  cantidadMascotas?: number;
  [key: string]: any;
}

interface Mascota {
  _id: string;
  nombre: string;
  especie: string;
  raza?: string;
  edad?: number;
  propietario: string | { nombre: string; [key: string]: any };
  createdAt?: string;
  [key: string]: any;
}

interface AuditoriaEvento {
  tipo: string;
  mensaje: string;
  fecha: string;
  usuario?: string;
  mascota?: string;
  dispositivo?: string;
  icono?: string;
  titulo?: string;
  [key: string]: any;
}

interface DispositivoData {
  id: string;
  serial: string;
  modelo: string;
  estado: string;
  bateria: string;
  ultimaConexion: string;
}

interface DispositivoItem {
  id: string;
  serial: string;
  modelo: string;
  estado: string;
  bateria: string;
  ultimaConexion: string;
}

interface ReporteItem {
  deviceId?: string;
  id?: string;
  serial: string;
  modelo: string;
  estado: string;
  bateria: string;
  ultimaConexion: string;
  mascota?: string;
  usuario?: string;
}

interface UbicacionItem {
  fecha?: string;
  timestamp?: string;
  lat: number;
  lng: number;
  accuracy: number;
  mascota?: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  method?: string;
  battery?: string;
}

interface AlertaItem {
  timestamp?: string;
  tipo?: string;
  prioridad?: string;
  mensaje?: string;
  dispositivo?: string;
  estado?: string;
}

interface ReporteData {
  total: number;
  data: ReporteItem[] | UbicacionItem[] | AlertaItem[];
  ubicaciones?: UbicacionItem[];
  alertas?: AlertaItem[];
}

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

  // Auth y Sesión
  loginForm!: FormGroup;
  loginError = '';
  isLoggedIn = false;
  adminData: AdminData | null = null;

  // Stats y Dashboard
  private _stats: DashboardStats | null = null;
  loadingStats = false;
  loadingAnalytics = false;
  loadingReports = false;
  loading = false;

  get stats(): DashboardStats {
    return this._stats || {
      totalUsuarios: 0,
      nuevosUsuarios30d: 0,
      totalMascotas: 0,
      nuevasMascotas30d: 0,
      totalDispositivos: 0,
      dispositivosActivos: 0,
      alertasUltimas24h: 0,
      alertasPorTipo: [],
      usuariosActivos: 0,
      mascotasPorEspecie: [],
      mascotasRegistradas: 0
    };
  }

  // Datos principales
  usuarios: Array<Usuario> = [];
  mascotas: Array<Mascota> = [];
  alertas: Array<AuditoriaEvento> = [];
  alertasZona: Array<AuditoriaEvento> = [];
  alertasDispositivo: Array<AuditoriaEvento> = [];
  alertasFiltradas: Array<AuditoriaEvento> = [];

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
  formatoExport: 'frontend' | 'backend' = 'frontend';

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

  // Formularios y modales
  usuarioForm!: FormGroup;
  mascotaForm!: FormGroup;
  showUsuarioModal = false;
  showMascotaModal = false;
  editingUsuario: Usuario | null = null;
  editingMascota: Mascota | null = null;

  // Reportes y Gráficos
  reporteFilters: ReporteFilters = {
    tipoReporte: 'dispositivos',
    fechaInicio: undefined,
    fechaFin: undefined,
    mascotaId: undefined
  };
  reporteData: ReporteData = { total: 0, data: [] };
  chartData: ChartData | null = null;
  dashboardCharts: DashboardCharts = {
    pieChart: null,
    barChart: null,
    lineChart: null
  };

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
      this.adminData = JSON.parse(adminData);
      this.isLoggedIn = true;
      await this.loadDashboardData();
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
        this.adminData = data.admin || data;
        this.isLoggedIn = true;
        localStorage.setItem('adminSession', JSON.stringify(this.adminData));
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
  private async loadDashboardData(): Promise<void> {
    if (!this.isLoggedIn) return;

    this.loadingStats = true;
    try {
      await Promise.all([
        this.loadStats(),
        this.loadUsers(),
        this.loadPets(),
        this.loadAlerts()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      this.loadingStats = false;
    }
  }

  private async loadStats(): Promise<void> {
    try {
      // Inicializar stats con valores por defecto
      this._stats = {
        totalUsuarios: 0,
        nuevosUsuarios30d: 0,
        totalMascotas: 0,
        nuevasMascotas30d: 0,
        totalDispositivos: 0,
        dispositivosActivos: 0,
        alertasUltimas24h: 0,
        alertasPorTipo: [],
        usuariosActivos: 0,
        mascotasPorEspecie: [],
        mascotasRegistradas: 0
      };

      const response = await fetch('http://localhost:3000/api/admin/dashboard-stats');
      if (!response.ok) throw new Error('Error loading stats');
      const data = await response.json();
      this._stats = {
        ...this.stats,
        ...data
      };
    } catch (error) {
      console.error('Error loading stats:', error);
      // stats ya está inicializado con valores por defecto
    }
  }

  private async loadUsers(page: number = 1): Promise<void> {
    try {
      const response = await fetch(
        `http://localhost:3000/api/admin/usuarios?page=${page}&limit=10&search=${this.searchTerm}`
      );
      if (!response.ok) throw new Error('Error loading users');
      const data = await response.json();
      this.usuarios = data.usuarios;
      this.usuariosTotal = data.total;
      this.usuariosPage = page;
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  private async loadPets(page: number = 1): Promise<void> {
    try {
      const response = await fetch(
        `http://localhost:3000/api/admin/mascotas?page=${page}&limit=10&search=${this.searchTerm}`
      );
      if (!response.ok) throw new Error('Error loading pets');
      const data = await response.json();
      this.mascotas = data.mascotas;
      this.mascotasTotal = data.total;
      this.mascotasPage = page;
    } catch (error) {
      console.error('Error loading pets:', error);
    }
  }

  private async loadAlerts(): Promise<void> {
    try {
      this.alertas = []; // Inicializar array
      const response = await fetch('http://localhost:3000/api/admin/alertas');
      if (!response.ok) throw new Error('Error loading alerts');
      const data = await response.json();
      this.alertas = Array.isArray(data.alertas) ? data.alertas : [];
      this.processAlerts();
    } catch (error) {
      console.error('Error loading alerts:', error);
      this.alertas = []; // En caso de error, asegurar que sea un array vacío
      this.processAlerts(); // Procesar incluso si hay error para inicializar las propiedades
    }
  }

  private processAlerts(): void {
    this.alertasZona = this.alertas.filter(a => a.tipo === 'zona');
    this.alertasDispositivo = this.alertas.filter(a => a.tipo === 'dispositivo');
    this.alertasFiltradas = this.alertas;
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

  openUsuarioModal(usuario?: Usuario): void {
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

  openMascotaModal(mascota?: Mascota): void {
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

    const data = {
      labels: ['Perros', 'Gatos', 'Otros'],
      datasets: [{
        data: [
          this.chartData.perros || 0,
          this.chartData.gatos || 0,
          this.chartData.otros || 0
        ],
        backgroundColor: ['#3b82f6', '#ef4444', '#10b981'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };

    this.dashboardCharts.pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 20, font: { size: 12 } }
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

    const data = {
      labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
      datasets: [{
        label: 'Actividad de Dispositivos',
        data: this.chartData.actividadMensual || [0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
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
            title: { display: true, text: 'Número de Registros' }
          },
          x: {
            title: { display: true, text: 'Meses' }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  private createLineChart(): void {
    if (!this.lineChartRef?.nativeElement || !this.chartData) return;

    const ctx = this.lineChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.dashboardCharts.lineChart?.destroy();

    const data = {
      labels: ['0-4h', '4-8h', '8-12h', '12-16h', '16-20h', '20-24h'],
      datasets: [{
        label: 'Dispositivos Activos',
        data: this.chartData.dispositivosActivos || [0, 0, 0, 0, 0, 0],
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgba(16, 185, 129, 1)',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6
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
            title: { display: true, text: 'Dispositivos Activos' }
          },
          x: {
            title: { display: true, text: 'Horarios del Día' }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  async loadDashboardCharts(): Promise<void> {
    this.loading = true;
    try {
      const response = await fetch('http://localhost:3000/api/admin/dashboard-stats', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      this.chartData = await response.json();

      if (!(window as any).Chart) {
        await this.loadChartJS();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setTimeout(() => this.createCharts(), 200);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      this.loading = false;
    }
  }

  // Estado de generación de reportes
  generatingReport = false;
  reportProgress = 0;
  currentOperation = '';

  // Interfaces para el reporte
  async generateReport(): Promise<void> {
    if (this.generatingReport) return;

    this.generatingReport = true;
    this.reportProgress = 0;
    this.currentOperation = 'Iniciando generación del reporte...';
    this.reporteData = { total: 0, data: [] };

    try {
      // Reiniciar estado
      const exportButtons = document.querySelectorAll('.export-button');
      exportButtons.forEach(btn => {
        btn.classList.add('disabled');
        (btn as HTMLButtonElement).disabled = true;
      });

      // Iniciar la solicitud
      this.currentOperation = 'Conectando con el servidor...';
      this.reportProgress = 10;
      this.cdr.detectChanges();

      const requestData = {
        tipoReporte: this.reporteFilters.tipoReporte || 'dispositivos',
        fechaInicio: this.reporteFilters.fechaInicio,
        fechaFin: this.reporteFilters.fechaFin,
        mascotaId: this.reporteFilters.mascotaId || ''
      };

      console.log('Enviando solicitud:', requestData);

      const response = await fetch('http://localhost:3000/api/admin/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      this.currentOperation = 'Procesando datos...';
      this.reportProgress = 50;
      this.cdr.detectChanges();

      const data = await response.json();
      console.log('Datos del reporte recibidos:', data);

      // Validar la estructura de la respuesta
      if (!data) {
        throw new Error('No se recibieron datos del servidor');
      }

      console.log('Estructura de datos recibida:', {
        isArray: Array.isArray(data),
        hasDispositivos: data.dispositivos ? true : false,
        keys: Object.keys(data)
      });

      // Validar que sea un reporte válido
      if (!data.tipo || !data.total || data.total === 0) {
        throw new Error('El reporte no contiene datos válidos');
      }


      // Extraer y estructurar los datos según el tipo de reporte
      let reportData: any[] = [];
      let total = 0;
      if (data.tipo === 'dispositivos' && Array.isArray(data.dispositivos)) {
        reportData = data.dispositivos.map((d: any) => ({
          id: d.id || d.deviceId || '',
          serial: d.serial || '',
          modelo: d.modelo || '',
          estado: d.estado || '',
          bateria: d.bateria || '',
          ultimaConexion: d.ultimaConexion || '',
          mascota: d.mascotaNombre || d.mascota || '',
          usuario: d.usuarioNombre || d.usuario || ''
        }));
        // Si hay filtro de mascota, filtrar aquí
        if (this.reporteFilters.mascotaId) {
          reportData = reportData.filter(item => item.mascota === this.mascotas.find(m => m._id === this.reporteFilters.mascotaId)?.nombre);
        }
        total = reportData.length;
        this.reporteData = {
          total: total,
          data: reportData,
          ubicaciones: this.reporteFilters.tipoReporte === 'ubicaciones' ? reportData : undefined,
          alertas: this.reporteFilters.tipoReporte === 'alertas' ? reportData : undefined
        };
      } else if (data.tipo === 'ubicaciones' && Array.isArray(data.ubicaciones)) {
        reportData = data.ubicaciones;
        if (this.reporteFilters.mascotaId) {
          reportData = reportData.filter(item => item.mascotaId === this.reporteFilters.mascotaId);
        }
        total = reportData.length;
        this.reporteData = {
          total: total,
          data: reportData,
          ubicaciones: reportData
        };
      } else if (data.tipo === 'mascotas' && Array.isArray(data.mascotas)) {
        reportData = data.mascotas;
        if (this.reporteFilters.mascotaId) {
          reportData = reportData.filter(item => item._id === this.reporteFilters.mascotaId);
        }
        total = reportData.length;
        this.reporteData = {
          total: total,
          data: reportData
        };
      } else {
        this.reporteData = { total: 0, data: [] };
      }

      // Actualizar UI
      this.reportProgress = 100;
      this.currentOperation = `Reporte generado exitosamente (${total} registros)`;
      this.cdr.detectChanges();

      // Habilitar botones de exportación
      requestAnimationFrame(() => {
        const exportButtons = document.querySelectorAll('.export-button');
        exportButtons.forEach(btn => {
          btn.classList.remove('disabled');
          (btn as HTMLButtonElement).disabled = false;
        });
      });

    } catch (error: any) {
      console.error('Error al generar reporte:', error);

      // Determinar mensaje de error más específico
      let errorMessage = 'Error desconocido';
      if (error.message.includes('formato de respuesta')) {
        errorMessage = 'El formato de los datos recibidos no es válido';
      } else if (error.message.includes('del servidor')) {
        errorMessage = `Error de conexión con el servidor: ${error.message}`;
      } else {
        errorMessage = error.message || 'Error al generar el reporte';
      }

      // Actualizar UI con el error
      this.currentOperation = `Error: ${errorMessage}`;
      this.reportProgress = 0;
      this.cdr.detectChanges();

      // Mostrar alerta al usuario con más detalles
      alert(`Error al generar el reporte:\n${errorMessage}`);

      // Reiniciar estado de botones
      const exportButtons = document.querySelectorAll('.export-button');
      exportButtons.forEach(btn => {
        btn.classList.add('disabled');
        (btn as HTMLButtonElement).disabled = true;
      });
    } finally {
      this.generatingReport = false;
      this.cdr.detectChanges(); // Asegurar que la UI se actualice
    }
  }

  async exportToPDF(): Promise<void> {
    if (this.reporteData.total === 0) {
      alert('Primero debe generar un reporte');
      return;
    }

    try {
      // Configura las fuentes para pdfMake
      const pdfMakeVfs = (pdfFonts as any).pdfMake.vfs;
      const pdfMakeInstance = pdfMake;
      (pdfMakeInstance as any).vfs = pdfMakeVfs;

      // Define el contenido del documento
      const docDefinition: any = {
        content: [
          { text: `Reporte de ${this.reporteFilters.tipoReporte}`, style: 'header' },
          { text: `Generado el ${new Date().toLocaleDateString()}`, style: 'subheader' },
          { text: '\n' }, // Espacio
          {
            table: {
              headerRows: 1,
              widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
              body: [
                // Encabezados según tipo de reporte
                this.reporteFilters.tipoReporte === 'dispositivos'
                  ? ['ID', 'Serial', 'Modelo', 'Estado', 'Batería', 'Última Conexión']
                  : ['Campo no disponible'],
                // Datos
                ...this.reporteData.data.map((item: any) =>
                  this.reporteFilters.tipoReporte === 'dispositivos'
                    ? [
                        item.deviceId || 'N/A',
                        item.serial || 'N/A',
                        item.modelo || 'N/A',
                        item.estado || 'N/A',
                        item.bateria || 'N/A',
                        item.ultimaConexion ? new Date(item.ultimaConexion).toLocaleString() : 'N/A'
                      ]
                    : ['Datos no disponibles']
                )
              ]
            }
          }
        ],
        styles: {
          header: {
            fontSize: 18,
            bold: true,
            margin: { top: 0, right: 0, bottom: 10, left: 0 }
          },
          subheader: {
            fontSize: 14,
            bold: false,
            margin: { top: 0, right: 0, bottom: 5, left: 0 }
          }
        }
      };

      // Genera y descarga el PDF
      pdfMake.createPdf(docDefinition).download(`reporte_${this.reporteFilters.tipoReporte}_${new Date().toISOString()}.pdf`);
    } catch (error) {
      console.error('Error al exportar a PDF:', error);
      alert('Error al exportar a PDF');
    }
  }

  private getPDFContent() {
    if (!this.reporteData || !Array.isArray(this.reporteData.data)) {
      return { text: 'No hay datos disponibles' };
    }

    // Personaliza según el tipo de reporte
    switch (this.reporteFilters.tipoReporte) {
      case 'ubicaciones':
        return {
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*'],
            body: [
              ['Fecha', 'Latitud', 'Longitud', 'Precisión'],
              ...this.reporteData.data.map(item => {
                const ubicacion = item as UbicacionItem;
                return [
                  new Date(ubicacion.fecha || ubicacion.timestamp || '').toLocaleString(),
                  ubicacion.lat?.toString() || 'N/A',
                  ubicacion.lng?.toString() || 'N/A',
                  ubicacion.accuracy?.toString() || 'N/A'
                ];
              })
            ]
          }
        };
      case 'dispositivos':
        return {
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*', '*', '*'],
            body: [
              ['ID', 'Serial', 'Modelo', 'Estado', 'Batería', 'Última Conexión'],
              ...this.reporteData.data.map(item => {
                const dispositivo = item as ReporteItem;
                return [
                  dispositivo.deviceId || 'N/A',
                  dispositivo.serial || 'N/A',
                  dispositivo.modelo || 'N/A',
                  dispositivo.estado || 'N/A',
                  dispositivo.bateria || 'N/A',
                  dispositivo.ultimaConexion || 'N/A'
                ];
              })
            ]
          }
        };
      default:
        return { text: 'No hay datos disponibles' };
    }
  }

  async exportToExcel(): Promise<void> {
    if (this.reporteData.total === 0) {
      alert('Primero debe generar un reporte');
      return;
    }

    this.loading = true;
    try {
      if (this.formatoExport === 'frontend') {
        // Generar Excel en el frontend
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte');

        // Configurar columnas según el tipo de reporte
        switch (this.reporteFilters.tipoReporte) {
          case 'ubicaciones':
            worksheet.columns = [
              { header: 'Fecha', key: 'fecha' },
              { header: 'Latitud', key: 'lat' },
              { header: 'Longitud', key: 'lng' },
              { header: 'Precisión', key: 'accuracy' }
            ];
            break;
          case 'dispositivos':
            worksheet.columns = [
              { header: 'ID Dispositivo', key: 'deviceId', width: 15 },
              { header: 'Serial', key: 'serial', width: 15 },
              { header: 'Modelo', key: 'modelo', width: 15 },
              { header: 'Estado', key: 'estado', width: 15 },
              { header: 'Batería', key: 'bateria', width: 10 },
              { header: 'Última Conexión', key: 'ultimaConexion', width: 20 }
            ];

            // Formatear los datos
            const formattedData = this.reporteData.data.map((item: any) => ({
              deviceId: item.deviceId || item.id || 'N/A',
              serial: item.serial || 'N/A',
              modelo: item.modelo || 'N/A',
              estado: item.estado || 'N/A',
              bateria: item.bateria || 'N/A',
              ultimaConexion: item.ultimaConexion ? new Date(item.ultimaConexion).toLocaleString() : 'N/A'
            }));

            worksheet.addRows(formattedData);
            break;
          case 'mascotas':
            worksheet.columns = [
              { header: 'Nombre', key: 'nombre' },
              { header: 'Especie', key: 'especie' },
              { header: 'Raza', key: 'raza' },
              { header: 'Edad', key: 'edad' },
              { header: 'Propietario', key: 'propietario' }
            ];
            break;
        }

        // Agregar datos
        if (Array.isArray(this.reporteData.data)) {
          worksheet.addRows(this.reporteData.data);
        }

        // Dar formato a las columnas
        worksheet.columns.forEach(column => {
          column.width = 15;
        });

        // Dar formato a las columnas
        worksheet.columns.forEach(column => {
          column.width = 15;
        });

        // Generar archivo
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_${this.reporteFilters.tipoReporte}_${new Date().toISOString()}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        // Generar Excel en el backend
        const response = await fetch('http://localhost:3000/api/admin/generate-excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipoReporte: this.reporteFilters.tipoReporte,
            fechaInicio: this.reporteFilters.fechaInicio,
            fechaFin: this.reporteFilters.fechaFin,
            mascotaId: this.reporteFilters.mascotaId
          })
        });

        if (!response.ok) throw new Error(`Error: ${response.status}`);

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte-onichip-${this.reporteFilters.tipoReporte}-${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      alert('Error al exportar a Excel: ' + error);
    } finally {
      this.loading = false;
    }
  }

  // ==== NAVEGACIÓN Y UI ====
  setActiveTab(tab: string): void {
    if (this.loading) return;

    this.activeTab = tab;
    this.searchTerm = '';

    switch (tab) {
      case 'usuarios':
        this.loadUsers();
        break;
      case 'mascotas':
        this.loadPets();
        break;
      case 'reportes':
        this.loadDashboardCharts();
        break;
      default:
        this.loadDashboardData();
    }

    const adminContent = document.querySelector('.admin-content');
    if (adminContent) {
      if (tab === 'reportes') {
        adminContent.classList.add('reportes-active');
      } else {
        adminContent.classList.remove('reportes-active');
      }
    }

    this.cdr.detectChanges();
  }

  getShortId(id: string): string {
    return id.slice(-6);
  }

  getReporteDataSlice(limit: number = 10): any[] {
    if (!this.reporteData?.data || !Array.isArray(this.reporteData.data)) {
      return [];
    }
    return this.reporteData.data.slice(0, limit);
  }

  getUbicacionesSlice(limit: number = 10): UbicacionItem[] {
    if (!this.reporteData?.ubicaciones || !Array.isArray(this.reporteData.ubicaciones)) {
      return [];
    }
    return this.reporteData.ubicaciones.slice(0, limit);
  }

  getAlertasSlice(limit: number = 10): AlertaItem[] {
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

  nextPage(): void {
    if (this.activeTab === 'usuarios') {
      this.loadUsers(this.usuariosPage + 1);
    } else if (this.activeTab === 'mascotas') {
      this.loadPets(this.mascotasPage + 1);
    }
  }
}
