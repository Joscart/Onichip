
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../app/services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss'
})
export class Admin implements OnInit {
  // 🔐 Autenticación
  isLoggedIn = false;
  adminData: any = null;
  loginForm: FormGroup;
  loginError = '';

  // 📊 Dashboard
  stats: any = {};
  alertas: any[] = [];
  reportes: any = {};

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

  // 📊 DASHBOARD
  async loadDashboard() {
    try {
      const [statsRes, alertasRes, reportesRes] = await Promise.all([
        fetch('http://localhost:3000/api/admin/dashboard'),
        fetch('http://localhost:3000/api/admin/alertas'),
        fetch('http://localhost:3000/api/admin/reportes')
      ]);

      this.stats = await statsRes.json();
      this.alertas = await alertasRes.json();
      this.reportes = await reportesRes.json();
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading dashboard:', error);
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

  // 🎛️ NAVEGACIÓN
  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.searchTerm = '';

    switch(tab) {
      case 'usuarios':
        this.loadUsuarios();
        break;
      case 'mascotas':
        this.loadMascotas();
        break;
      case 'dashboard':
        this.loadDashboard();
        break;
    }
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
}
