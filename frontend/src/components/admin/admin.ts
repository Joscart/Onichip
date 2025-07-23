
import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../app/services/auth.service';

// Importar Chart.js
declare const Chart: any;

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss'
})
export class Admin implements OnInit, AfterViewInit {
  // Referencias a canvas para gráficos
  @ViewChild('pieChart') pieChartRef!: ElementRef;
  @ViewChild('barChart') barChartRef!: ElementRef;
  @ViewChild('lineChart') lineChartRef!: ElementRef;

  // 🔐 Autenticación
  isLoggedIn = false;
  adminData: any = null;
  loginForm: FormGroup;
  loginError = '';

  // 📊 Dashboard GPS
  stats: any = {};
  alertasGPS: any[] = [];
  mascotasEnMapa: any[] = [];
  gpsAnalytics: any = null;
  alertas: any[] = [];
  reportes: any = null;
  analyticsData: any = null;
  charts: any = { pie: null, bar: null, line: null };
  
  // �️ Mapas
  filtroMapa = 'todos';
  tiempoRealActivo = false;
  ultimaActualizacion = '2 minutos';

  // 🚨 Alertas GPS
  filtroAlertas = 'todas';
  alertasCriticas: any[] = [];
  alertasZona: any[] = [];
  alertasDispositivo: any[] = [];
  alertasFiltradas: any[] = [];

  // � Ubicaciones
  ubicacionesFiltradas: any[] = [];
  filtroUbicacion = {
    mascota: '',
    fechaInicio: '',
    fechaFin: ''
  };

  // 📱 Dispositivos GPS
  dispositivos: any[] = [];
  datosIoT: any[] = [];
  
  // 📊 Filtros de reportes
  reportFilters = {
    tipo: 'usuarios',
    fechaInicio: '',
    fechaFin: ''
  };
  
  // Filtros
  filtroMascotas = { especie: '', estado: '' };
  mascotasFiltradas: any[] = [];
  usuariosFiltrados: any[] = [];

  // 👥 Gestión de usuarios
  usuarios: any[] = [];
  usuariosPage = 1;
  usuariosTotal = 0;
  usuarioForm: FormGroup;
  editingUsuario: any = null;

  // 🐕 Gestión de mascotas
  mascotas: any[] = [];
  mascotasPage = 1;
  mascotasTotal = 0;
  mascotaForm: FormGroup;
  editingMascota: any = null;

  // 🎛️ Control de pestañas
  activeTab = 'dashboard';
  loading = false;
  loadingStats = false;
  loadingAnalytics = false;
  loadingReports = false;
  searchTerm = '';

  // 📝 Modales
  showUsuarioModal = false;
  showMascotaModal = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.usuarioForm = this.fb.group({
      nombre: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.minLength(6)],
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

    ngOnInit() {
    // Verificar si ya hay sesión de admin
    const adminSession = localStorage.getItem('adminSession');
    if (adminSession) {
      this.adminData = JSON.parse(adminSession);
      this.isLoggedIn = true;
      this.loadDashboard();
      this.loadUsuarios();
      this.loadMascotas();
    }

    // Cargar Chart.js de forma dinámica
    this.loadChartJS();
  }

  ngAfterViewInit() {
    // Los gráficos se inicializarán cuando se carguen los datos de analytics
  }

  async loadChartJS() {
    if (!(window as any).Chart) {
      try {
        // Cargar Chart.js desde CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => {
          console.log('Chart.js loaded successfully');
        };
        document.head.appendChild(script);
      } catch (error) {
        console.error('Error loading Chart.js:', error);
      }
    }
  }

  // 🔐 AUTENTICACIÓN
  login() {
    if (this.loginForm.invalid) return;
    this.loading = true;
    this.loginError = '';
    const { email, password } = this.loginForm.value;
    this.auth.login(email, password).subscribe({
      next: (res) => {
        if (res.admin) {
          this.adminData = res.admin;
          this.isLoggedIn = true;
          localStorage.setItem('adminSession', JSON.stringify(res.admin));
          this.loadDashboard();
        } else {
          this.loginError = 'No es un administrador válido.';
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loginError = err.error?.message || 'Error de conexión';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  logout() {
    this.isLoggedIn = false;
    this.adminData = null;
    localStorage.removeItem('adminSession');
    this.loginForm.reset();
    this.activeTab = 'dashboard';
  }

  // 📊 DASHBOARD GPS - OPTIMIZADO
  async loadDashboard() {
    try {
      console.log('🛰️ Cargando dashboard GPS...');
      this.loadingStats = true;
      
      // Usar setTimeout para evitar ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(async () => {
        try {
          // Cargar estadísticas GPS desde el nuevo endpoint
          const statsRes = await fetch('http://localhost:3000/api/admin/estadisticas-gps');
          if (statsRes.ok) {
            const gpsStats = await statsRes.json();
            console.log('📊 Stats GPS cargadas:', gpsStats);
            
            // Mapear datos GPS al formato esperado
            this.stats = {
              dispositivosActivos: gpsStats.resumen.dispositivosActivos,
              ubicacionesHoy: gpsStats.resumen.ubicaciones24h,
              alertasGPS: gpsStats.resumen.alertasActivas,
              totalMascotas: gpsStats.resumen.totalDispositivos,
              dispositivosOnline: gpsStats.dispositivos.estados.online,
              dispositivosOffline: gpsStats.dispositivos.estados.offline,
              dispositivosBateriaBaja: gpsStats.dispositivos.estados.bateria_baja,
              zonasSeguras: gpsStats.resumen.zonasSeguras,
              precisionGPS: gpsStats.resumen.precisionPromedio,
              cobertura: gpsStats.rendimiento.cobertura,
              alertasPorTipo: gpsStats.alertas.tipos
            };
            
            // Guardar datos completos para otras secciones
            this.gpsAnalytics = gpsStats;
            
          } else {
            console.warn('Endpoint GPS no disponible, usando datos simulados');
            this.stats = this.generateSimulatedGPSData();
          }
          
          this.loadingStats = false;
          this.cdr.detectChanges();
          
          // Cargar datos secundarios
          this.loadSecondaryGPSData();
          
        } catch (error) {
          console.error('Error cargando dashboard GPS:', error);
          this.stats = this.generateSimulatedGPSData();
          this.loadingStats = false;
          this.cdr.detectChanges();
        }
      }, 0);
      
    } catch (error) {
      console.error('Error inicial dashboard:', error);
      this.loadingStats = false;
    }
  }

  private generateSimulatedGPSData() {
    return {
      dispositivosActivos: 12,
      ubicacionesHoy: 1456,
      alertasGPS: 3,
      totalMascotas: 45,
      dispositivosOnline: 10,
      dispositivosOffline: 2,
      dispositivosBateriaBaja: 1,
      zonasSeguras: 8,
      precisionGPS: 3.2,
      cobertura: 96.5,
      alertasPorTipo: {
        geofence: 2,
        bateria: 1,
        inactividad: 0
      }
    };
  }

  private async loadSecondaryGPSData() {
    try {
      // Cargar datos adicionales para el dashboard GPS
      const alertasGPS = this.generateMockGPSAlerts();
      this.alertas = alertasGPS;
      
      // Simular dispositivos recientes
      this.dispositivos = this.generateMockDevices();
      
      this.cdr.detectChanges();
    } catch (error) {
      console.warn('Error cargando datos secundarios GPS:', error);
    }
  }

  private generateMockGPSAlerts() {
    return [
      {
        id: 1,
        tipo: 'Geofence',
        mascota: 'Luna',
        mensaje: 'Salió de zona segura "Casa"',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        prioridad: 'alta'
      },
      {
        id: 2,
        tipo: 'Batería',
        mascota: 'Max',
        mensaje: 'Batería baja (15%)',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        prioridad: 'media'
      },
      {
        id: 3,
        tipo: 'Inactividad',
        mascota: 'Bella',
        mensaje: 'Sin movimiento por 3 horas',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
        prioridad: 'baja'
      }
    ];
  }

  private generateMockDevices() {
    return [
      {
        id: 'GPS001',
        mascota: 'Luna',
        estado: 'online',
        bateria: 85,
        ultimaUbicacion: '19.432, -99.133',
        ultimaActualizacion: new Date(Date.now() - 5 * 60 * 1000)
      },
      {
        id: 'GPS002',
        mascota: 'Max',
        estado: 'bateria_baja',
        bateria: 15,
        ultimaUbicacion: '19.425, -99.140',
        ultimaActualizacion: new Date(Date.now() - 10 * 60 * 1000)
      },
      {
        id: 'GPS003',
        mascota: 'Bella',
        estado: 'offline',
        bateria: 0,
        ultimaUbicacion: '19.420, -99.135',
        ultimaActualizacion: new Date(Date.now() - 3 * 60 * 60 * 1000)
      }
    ];
  }

  private async loadSecondaryData() {
    try {
      const [alertasRes, reportesRes] = await Promise.all([
        fetch('http://localhost:3000/api/admin/datos-iot?limit=5').catch(() => null),
        fetch('http://localhost:3000/api/admin/dashboard-charts').catch(() => null)
      ]);

      if (alertasRes?.ok) {
        const alertasData = await alertasRes.json();
        this.alertas = alertasData.datos?.filter((d: any) => d.alertas?.length > 0)?.slice(0, 3) || [];
      }
      
      if (reportesRes?.ok) {
        this.reportes = await reportesRes.json();
      }
      
      this.cdr.detectChanges();
    } catch (error) {
      console.warn('Error cargando datos secundarios:', error);
    }
  }

  // 👥 GESTIÓN DE USUARIOS
  async loadUsuarios() {
    try {
      this.loading = true;
      const response = await fetch(
        `http://localhost:3000/api/admin/usuarios?page=${this.usuariosPage}&search=${this.searchTerm}`
      );
      const data = await response.json();

      this.usuarios = data.usuarios;
      this.usuariosTotal = data.totalUsuarios;
      this.loading = false;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading usuarios:', error);
      this.loading = false;
    }
  }

  openUsuarioModal(usuario?: any) {
    this.editingUsuario = usuario;
    this.showUsuarioModal = true;

    if (usuario) {
      this.usuarioForm.patchValue(usuario);
      this.usuarioForm.get('password')?.clearValidators();
    } else {
      this.usuarioForm.reset();
      this.usuarioForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    }
    this.usuarioForm.get('password')?.updateValueAndValidity();
  }

  async saveUsuario() {
    if (this.usuarioForm.invalid) return;

    try {
      this.loading = true;
      const formData = this.usuarioForm.value;

      // Si estamos editando y no hay password, no enviarlo
      if (this.editingUsuario && !formData.password) {
        delete formData.password;
      }

      const url = this.editingUsuario
        ? `http://localhost:3000/api/admin/usuarios/${this.editingUsuario._id}`
        : 'http://localhost:3000/api/admin/usuarios';

      const method = this.editingUsuario ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      this.closeUsuarioModal();
      this.loadUsuarios();
      this.loadDashboard(); // Actualizar stats
    } catch (error) {
      console.error('Error saving usuario:', error);
    } finally {
      this.loading = false;
    }
  }

  async deleteUsuario(id: string) {
    if (!confirm('¿Estás seguro de eliminar este usuario? También se eliminarán todas sus mascotas.')) return;

    try {
      await fetch(`http://localhost:3000/api/admin/usuarios/${id}`, { method: 'DELETE' });
      this.loadUsuarios();
      this.loadDashboard();
    } catch (error) {
      console.error('Error deleting usuario:', error);
    }
  }

  closeUsuarioModal() {
    this.showUsuarioModal = false;
    this.editingUsuario = null;
    this.usuarioForm.reset();
  }

  // 🐕 GESTIÓN DE MASCOTAS
  async loadMascotas() {
    try {
      this.loading = true;
      const response = await fetch(
        `http://localhost:3000/api/admin/mascotas?page=${this.mascotasPage}&search=${this.searchTerm}`
      );
      const data = await response.json();

      this.mascotas = data.mascotas;
      this.mascotasTotal = data.totalMascotas;
      this.loading = false;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading mascotas:', error);
      this.loading = false;
    }
  }

  openMascotaModal(mascota?: any) {
    this.editingMascota = mascota;
    this.showMascotaModal = true;

    if (mascota) {
      this.mascotaForm.patchValue({
        ...mascota,
        propietario: mascota.propietario._id
      });
    } else {
      this.mascotaForm.reset();
    }
  }

  async saveMascota() {
    if (this.mascotaForm.invalid) return;

    try {
      this.loading = true;
      const url = this.editingMascota
        ? `http://localhost:3000/api/admin/mascotas/${this.editingMascota._id}`
        : 'http://localhost:3000/api/mascotas';

      const method = this.editingMascota ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.mascotaForm.value)
      });

      this.closeMascotaModal();
      this.loadMascotas();
      this.loadDashboard();
    } catch (error) {
      console.error('Error saving mascota:', error);
    } finally {
      this.loading = false;
    }
  }

  async deleteMascota(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta mascota?')) return;

    try {
      await fetch(`http://localhost:3000/api/admin/mascotas/${id}`, { method: 'DELETE' });
      this.loadMascotas();
      this.loadDashboard();
    } catch (error) {
      console.error('Error deleting mascota:', error);
    }
  }

  closeMascotaModal() {
    this.showMascotaModal = false;
    this.editingMascota = null;
    this.mascotaForm.reset();
  }

  // 🔍 BÚSQUEDA
  onSearch() {
    if (this.activeTab === 'usuarios') {
      this.usuariosPage = 1;
      this.loadUsuarios();
    } else if (this.activeTab === 'mascotas') {
      this.mascotasPage = 1;
      this.loadMascotas();
    }
  }

  // 📄 PAGINACIÓN
  nextPage() {
    if (this.activeTab === 'usuarios') {
      this.usuariosPage++;
      this.loadUsuarios();
    } else if (this.activeTab === 'mascotas') {
      this.mascotasPage++;
      this.loadMascotas();
    }
  }

  prevPage() {
    if (this.activeTab === 'usuarios' && this.usuariosPage > 1) {
      this.usuariosPage--;
      this.loadUsuarios();
    } else if (this.activeTab === 'mascotas' && this.mascotasPage > 1) {
      this.mascotasPage--;
      this.loadMascotas();
    }
  }

  // 🔧 UTILIDADES
  getAlertClass(tipo: string): string {
    const classes = {
      'success': 'alert-success',
      'warning': 'alert-warning',
      'error': 'alert-error'
    };
    return classes[tipo as keyof typeof classes] || 'alert-info';
  }

  formatDate(date: string | Date | undefined | null): string {
    if (!date) {
      return 'Sin fecha';
    }

    try {
      const fechaObj = new Date(date);

      // Verificar si la fecha es válida
      if (isNaN(fechaObj.getTime())) {
        return 'Fecha inválida';
      }

      return fechaObj.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Error en fecha';
    }
  }

  getShortId(id: string): string {
    if (!id) {
      return 'N/A';
    }
    // Tomar los primeros 8 caracteres del ID para hacerlo más legible
    return id.substring(0, 8).toUpperCase();
  }

  // 📈 ANALYTICS FUNCTIONS
  // 📈 ANALYTICS - MÁS OPTIMIZADO
  async loadAnalytics() {
    try {
      console.log('⚡ Cargando analytics ultra-optimizado...');
      this.loadingAnalytics = true;
      
      // Usar setTimeout para evitar bloqueo de UI y errores de Angular
      setTimeout(async () => {
        try {
          const response = await fetch('http://localhost:3000/api/admin/dashboard-charts');
          if (!response.ok) {
            throw new Error('Error en la respuesta del servidor');
          }
          
          const data = await response.json();
          console.log('📊 Analytics cargados:', data.optimizado ? '⚡ ULTRA-OPTIMIZADO' : '🐌 normal');
          
          this.analyticsData = data;
          this.loadingAnalytics = false;
          this.cdr.detectChanges();
          
          // Crear gráficos de forma muy asíncrona
          setTimeout(() => {
            this.createCharts();
          }, 100);
          
        } catch (error) {
          console.error('Error loading analytics:', error);
          // Mostrar gráficos de ejemplo en caso de error
          this.analyticsData = {
            graficos: {
              especies: { datos: [{ label: 'Sin datos', value: 1 }] },
              actividad: { datos: [{ fecha: new Date().toISOString().split('T')[0], cantidad: 0 }] },
              estado: { datos: [{ label: 'Sin datos', value: 1 }] }
            },
            optimizado: false
          };
          this.loadingAnalytics = false;
          this.cdr.detectChanges();
        }
      }, 0);
      
    } catch (error) {
      console.error('Error inicial analytics:', error);
      this.loadingAnalytics = false;
    }
  }

  createCharts() {
    if (!(window as any).Chart || !this.analyticsData) {
      console.log('Chart.js not loaded or no analytics data');
      return;
    }

    this.createPieChart();
    this.createBarChart();
    this.createLineChart();
  }

  createPieChart() {
    if (!this.pieChartRef?.nativeElement || !this.analyticsData.graficos?.especies) return;

    const ctx = this.pieChartRef.nativeElement.getContext('2d');
    const data = this.analyticsData.graficos.especies.datos;

    if (this.charts.pie) {
      this.charts.pie.destroy();
    }

    this.charts.pie = new (window as any).Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map((item: any) => item.label),
        datasets: [{
          data: data.map((item: any) => item.value),
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          },
          title: {
            display: true,
            text: 'Distribución por Especies'
          }
        }
      }
    });
  }

  createBarChart() {
    if (!this.barChartRef?.nativeElement || !this.analyticsData.graficos?.actividad) return;

    const ctx = this.barChartRef.nativeElement.getContext('2d');
    const rawData = this.analyticsData.graficos.actividad.datos;

    // Procesar datos para el gráfico de barras
    const fechas = [...new Set(rawData.map((item: any) => item._id.fecha))].sort();
    const actividades = [...new Set(rawData.map((item: any) => item._id.actividad))];

    const datasets = actividades.map((actividad, index) => ({
      label: actividad,
      data: fechas.map(fecha => {
        const item = rawData.find((d: any) => d._id.fecha === fecha && d._id.actividad === actividad);
        return item ? item.count : 0;
      }),
      backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'][index % 4],
      borderWidth: 1
    }));

    if (this.charts.bar) {
      this.charts.bar.destroy();
    }

    this.charts.bar = new (window as any).Chart(ctx, {
      type: 'bar',
      data: {
        labels: fechas,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Cantidad de Registros'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Fecha'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          },
          title: {
            display: true,
            text: 'Actividad por Día'
          }
        }
      }
    });
  }

  createLineChart() {
    if (!this.lineChartRef?.nativeElement || !this.analyticsData.graficos?.temperatura) return;

    const ctx = this.lineChartRef.nativeElement.getContext('2d');
    const data = this.analyticsData.graficos.temperatura.datos;

    if (this.charts.line) {
      this.charts.line.destroy();
    }

    this.charts.line = new (window as any).Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((item: any) => `${item.hora}:00`),
        datasets: [{
          label: 'Temperatura °C',
          data: data.map((item: any) => item.temperatura),
          borderColor: '#FF6384',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: 'Temperatura (°C)'
            },
            min: 35,
            max: 42
          },
          x: {
            title: {
              display: true,
              text: 'Hora del día'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          },
          title: {
            display: true,
            text: 'Temperatura Promedio por Hora'
          }
        }
      }
    });
  }

  // 📄 REPORTES FUNCTIONS - MÁS OPTIMIZADO
  async loadDatosIoT() {
    try {
      console.log('⚡ Cargando datos IoT ultra-optimizado...');
      this.loadingReports = true;
      
      // Usar setTimeout para evitar bloqueo de UI
      setTimeout(async () => {
        try {
          // Límite aún más pequeño para carga inicial súper rápida
          let url = 'http://localhost:3000/api/admin/datos-iot?limit=10';
          
          if (this.reportFilters.fechaInicio) {
            url += `&fechaInicio=${this.reportFilters.fechaInicio}`;
          }
          if (this.reportFilters.fechaFin) {
            url += `&fechaFin=${this.reportFilters.fechaFin}`;
          }

          const response = await fetch(url);
          if (!response.ok) {
            throw new Error('Error al cargar datos IoT');
          }
          
          const data = await response.json();
          console.log('📊 Datos IoT cargados:', data.ultraOptimizado ? '⚡ ULTRA-OPTIMIZADO' : '🐌 normal');
          
          this.datosIoT = data.datos || [];
          this.loadingReports = false;
          this.cdr.detectChanges();
          
        } catch (error) {
          console.error('Error loading datos IoT:', error);
          this.datosIoT = [];
          this.loadingReports = false;
          this.cdr.detectChanges();
        }
      }, 0);
      
    } catch (error) {
      console.error('Error inicial IoT:', error);
      this.loadingReports = false;
    }
  }

  async exportToExcel() {
    try {
      console.log('⚡ Generando reporte Excel optimizado...');
      this.loading = true;
      
      let url = 'http://localhost:3000/api/admin/reportes/excel?';
      
      if (this.reportFilters.fechaInicio) {
        url += `fechaInicio=${this.reportFilters.fechaInicio}&`;
      }
      if (this.reportFilters.fechaFin) {
        url += `fechaFin=${this.reportFilters.fechaFin}&`;
      }
      url += `tipo=${this.reportFilters.tipo}`;

      // Mostrar progreso al usuario
      const startTime = Date.now();
      console.log('⏱️ Iniciando descarga...');
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Error al generar reporte');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `reporte-onichip-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      const endTime = Date.now();
      console.log(`⚡ Reporte generado en ${endTime - startTime}ms`);
      alert('✅ Reporte Excel descargado exitosamente');
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('❌ Error al generar reporte Excel. Intenta con un rango de fechas más pequeño.');
    } finally {
      this.loading = false;
    }
  }

  async exportToPDF() {
    try {
      this.loading = true;
      
      // Simular generación de PDF (aquí podrías implementar una función más compleja)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      alert('🚧 Funcionalidad de PDF en desarrollo. Por ahora usa el reporte Excel.');
      
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('❌ Error al generar reporte PDF');
    } finally {
      this.loading = false;
    }
  }

  async generateSampleData() {
    try {
      this.loading = true;
      
      const response = await fetch('http://localhost:3000/api/admin/datos-iot/generar-ejemplo', {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`✅ Se generaron ${result.registros} registros IoT de ejemplo para ${result.mascotas} mascotas`);
        this.loadDatosIoT(); // Recargar datos
        if (this.activeTab === 'analytics') {
          this.loadAnalytics(); // Recargar analytics si está activo
        }
      } else {
        throw new Error(result.message);
      }
      
    } catch (error) {
      console.error('Error generating sample data:', error);
      alert('❌ Error al generar datos de ejemplo');
    } finally {
      this.loading = false;
    }
  }

  // 🎛️ NAVEGACIÓN ACTUALIZADA GPS
  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.searchTerm = '';

    switch(tab) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'mapas':
        this.loadMapas();
        break;
      case 'alertas':
        this.loadAlertasGPS();
        break;
      case 'ubicaciones':
        this.loadUbicaciones();
        break;
      case 'dispositivos':
        this.loadDispositivos();
        break;
      case 'usuarios':
        this.loadUsuarios();
        break;
      case 'mascotas':
        this.loadMascotas();
        break;
    }
  }

  // 🗺️ MÉTODOS PARA MAPAS GPS
  async loadMapas() {
    try {
      this.loading = true;
      
      // Simular datos de mascotas en el mapa
      this.mascotasEnMapa = [
        {
          id: '1',
          nombre: 'Max',
          especie: 'Perro',
          ubicacion: 'Parque Central',
          posX: 25,
          posY: 30,
          estado: 'activo',
          ultimaActualizacion: 'hace 2 min'
        },
        {
          id: '2',
          nombre: 'Luna',
          especie: 'Gato',
          ubicacion: 'Casa',
          posX: 60,
          posY: 45,
          estado: 'activo',
          ultimaActualizacion: 'hace 5 min'
        },
        {
          id: '3',
          nombre: 'Rocky',
          especie: 'Perro',
          ubicacion: 'Plaza Mayor',
          posX: 80,
          posY: 70,
          estado: 'alerta',
          ultimaActualizacion: 'hace 1 min'
        }
      ];
      
    } catch (error) {
      console.error('Error loading maps:', error);
    } finally {
      this.loading = false;
    }
  }

  actualizarMapas() {
    this.loadMapas();
    this.ultimaActualizacion = '0 segundos';
  }

  verModoSatelite() {
    alert('🛰️ Cambiando a vista satelital...');
  }

  aplicarFiltroMapa() {
    // Filtrar mascotas según el filtro seleccionado
    switch(this.filtroMapa) {
      case 'activos':
        this.mascotasEnMapa = this.mascotasEnMapa.filter(m => m.estado === 'activo');
        break;
      case 'alertas':
        this.mascotasEnMapa = this.mascotasEnMapa.filter(m => m.estado === 'alerta');
        break;
      default:
        this.loadMapas();
    }
  }

  toggleTiempoReal() {
    this.tiempoRealActivo = !this.tiempoRealActivo;
    if (this.tiempoRealActivo) {
      // Aquí se activaría la actualización automática cada X segundos
      console.log('Tiempo real activado');
    }
  }

  // 🚨 MÉTODOS PARA ALERTAS GPS
  async loadAlertasGPS() {
    try {
      this.loading = true;
      
      // Simular alertas GPS
      this.alertasGPS = [
        {
          id: '1',
          tipo: 'zona',
          prioridad: 'alta',
          icono: '🚨',
          titulo: 'Mascota fuera de zona segura',
          descripcion: 'Rocky ha salido de su zona segura definida',
          mascota: { nombre: 'Rocky' },
          ubicacion: 'Calle Principal 123',
          fecha: new Date()
        },
        {
          id: '2',
          tipo: 'dispositivo',
          prioridad: 'media',
          icono: '🔋',
          titulo: 'Batería baja',
          descripcion: 'El dispositivo GPS tiene menos del 20% de batería',
          mascota: { nombre: 'Max' },
          ubicacion: 'Parque Central',
          fecha: new Date(Date.now() - 300000) // 5 min ago
        }
      ];

      this.alertasCriticas = this.alertasGPS.filter(a => a.prioridad === 'alta');
      this.alertasZona = this.alertasGPS.filter(a => a.tipo === 'zona');
      this.alertasDispositivo = this.alertasGPS.filter(a => a.tipo === 'dispositivo');
      this.aplicarFiltroAlertas();
      
    } catch (error) {
      console.error('Error loading GPS alerts:', error);
    } finally {
      this.loading = false;
    }
  }

  aplicarFiltroAlertas() {
    switch(this.filtroAlertas) {
      case 'criticas':
        this.alertasFiltradas = this.alertasCriticas;
        break;
      case 'zona':
        this.alertasFiltradas = this.alertasZona;
        break;
      case 'dispositivo':
        this.alertasFiltradas = this.alertasDispositivo;
        break;
      default:
        this.alertasFiltradas = this.alertasGPS;
    }
  }

  actualizarAlertas() {
    this.loadAlertasGPS();
  }

  marcarTodasLeidas() {
    this.alertasGPS.forEach(alerta => alerta.leida = true);
    alert('✅ Todas las alertas marcadas como leídas');
  }

  verEnMapa(item: any) {
    this.setActiveTab('mapas');
    // Aquí se centraría el mapa en la ubicación específica
  }

  marcarLeida(alerta: any) {
    alerta.leida = true;
    alert('✅ Alerta marcada como leída');
  }

  // 📍 MÉTODOS PARA UBICACIONES
  async loadUbicaciones() {
    try {
      this.loading = true;
      
      // Simular historial de ubicaciones
      this.ubicacionesFiltradas = [
        {
          id: '1',
          mascota: { nombre: 'Max' },
          direccion: 'Parque Central, Zona Norte',
          latitud: -34.6037,
          longitud: -58.3816,
          precision: 5,
          fecha: new Date()
        },
        {
          id: '2',
          mascota: { nombre: 'Luna' },
          direccion: 'Av. Libertador 1234',
          latitud: -34.5950,
          longitud: -58.3723,
          precision: 3,
          fecha: new Date(Date.now() - 600000)
        }
      ];
      
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      this.loading = false;
    }
  }

  buscarUbicaciones() {
    this.loadUbicaciones();
    // Aquí se aplicarían los filtros de búsqueda
  }

  exportarUbicaciones() {
    alert('📊 Exportando historial de ubicaciones...');
  }

  limpiarHistorial() {
    if (confirm('¿Está seguro de que desea limpiar el historial de ubicaciones?')) {
      this.ubicacionesFiltradas = [];
      alert('🗑️ Historial limpiado');
    }
  }

  // 📱 MÉTODOS PARA DISPOSITIVOS GPS
  async loadDispositivos() {
    try {
      this.loading = true;
      
      // Simular dispositivos GPS
      this.dispositivos = [
        {
          id: '1',
          modelo: 'Onichip GPS Pro',
          serial: 'ONI-001-2024',
          estado: 'online',
          bateria: 85,
          mascota: { nombre: 'Max' },
          ultimaConexion: new Date()
        },
        {
          id: '2',
          modelo: 'Onichip GPS Lite',
          serial: 'ONI-002-2024',
          estado: 'offline',
          bateria: 15,
          mascota: { nombre: 'Luna' },
          ultimaConexion: new Date(Date.now() - 3600000)
        }
      ];
      
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      this.loading = false;
    }
  }

  agregarDispositivo() {
    alert('➕ Función para agregar nuevo dispositivo GPS');
  }

  sincronizarDispositivos() {
    this.loadDispositivos();
    alert('🔄 Dispositivos sincronizados');
  }

  configurarDispositivo(dispositivo: any) {
    alert(`⚙️ Configurando dispositivo ${dispositivo.serial}`);
  }

  verHistorial(dispositivo: any) {
    alert(`📊 Viendo historial de ${dispositivo.serial}`);
  }

  eliminarDispositivo(dispositivo: any) {
    if (confirm(`¿Eliminar dispositivo ${dispositivo.serial}?`)) {
      this.dispositivos = this.dispositivos.filter(d => d.id !== dispositivo.id);
      alert('🗑️ Dispositivo eliminado');
    }
  }

  // 🐕 MÉTODOS ADICIONALES PARA MASCOTAS GPS
  aplicarFiltroMascotas() {
    this.mascotasFiltradas = this.mascotas.filter(mascota => {
      const cumpleEspecie = !this.filtroMascotas.especie || mascota.especie === this.filtroMascotas.especie;
      const cumpleEstado = !this.filtroMascotas.estado || 
        (this.filtroMascotas.estado === 'activo' && mascota.dispositivoGPS) ||
        (this.filtroMascotas.estado === 'inactivo' && !mascota.dispositivoGPS);
      
      return cumpleEspecie && cumpleEstado;
    });
  }

  verUbicacion(mascota: any) {
    if (mascota.dispositivoGPS) {
      this.setActiveTab('mapas');
      alert(`📍 Viendo ubicación de ${mascota.nombre}`);
    }
  }

  // 👥 MÉTODOS ADICIONALES PARA USUARIOS
  buscarUsuarios() {
    this.usuariosFiltrados = this.usuarios.filter(usuario => 
      usuario.nombre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      usuario.email.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  verMascotas(usuario: any) {
    alert(`🐕 Viendo mascotas de ${usuario.nombre}`);
  }

  // 📍 Filtrar ubicaciones
  filtrarUbicaciones() {
    // Simular filtrado de ubicaciones
    this.ubicacionesFiltradas = [
      {
        mascota: 'Luna',
        latitud: '19.432',
        longitud: '-99.133',
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        precision: 3.2,
        bateria: 85
      },
      {
        mascota: 'Max',
        latitud: '19.425',
        longitud: '-99.140',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        precision: 2.8,
        bateria: 15
      },
      {
        mascota: 'Bella',
        latitud: '19.420',
        longitud: '-99.135',
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        precision: 4.1,
        bateria: 72
      }
    ];
    this.cdr.detectChanges();
  }

  // 🚨 Métodos para filtrar alertas
  getAlertasCriticas() {
    return this.alertas?.filter(a => a.prioridad === 'alta') || [];
  }

  getAlertasGeofence() {
    return this.alertas?.filter(a => a.tipo === 'Geofence') || [];
  }

  getAlertasBateria() {
    return this.alertas?.filter(a => a.tipo === 'Batería') || [];
  }
}
