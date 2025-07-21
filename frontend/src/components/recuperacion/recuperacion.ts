import { Component, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-recuperacion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './recuperacion.html',
  styleUrl: './recuperacion.css'
})
export class Recuperacion {
  emailForm: FormGroup;
  passwordForm: FormGroup;
  currentStep: 'email' | 'password' = 'email';
  loading = false;
  errorMsg = '';
  successMsg = '';
  emailValidado = '';

  constructor(
    private fb: FormBuilder, 
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.passwordForm = this.fb.group({
      nuevaContrasena: ['', [Validators.required, Validators.minLength(6)]],
      confirmarContrasena: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  // Validador personalizado para confirmar contraseñas
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('nuevaContrasena');
    const confirmPassword = form.get('confirmarContrasena');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      return { passwordMismatch: true };
    }
    return null;
  }

  // Paso 1: Validar email
  validarEmail() {
    if (this.emailForm.invalid) {
      this.errorMsg = 'Por favor, ingresa un correo electrónico válido.';
      return;
    }

    console.log('🔍 Iniciando validación de email...');
    this.loading = true;
    this.errorMsg = '';
    this.successMsg = '';
    const email = this.emailForm.get('email')?.value;
    console.log('📧 Email a validar:', email);
    
    console.log('🌐 Iniciando fetch request...');
    
    // Crear un timeout de 5 segundos para la prueba
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: La petición tardó más de 5 segundos')), 5000)
    );
    
    // Primero probemos el endpoint simple
    const fetchPromise = fetch('http://localhost:3000/api/test', {
      method: 'GET'
    });
    
    Promise.race([fetchPromise, timeoutPromise])
    .then((response: any) => {
      console.log('📡 Test response recibido:', response);
      console.log('📡 Test response status:', response.status);
      
      if (response.ok) {
        console.log('✅ Servidor responde correctamente, probando validación de email...');
        
        // Ahora probemos la validación de email
        return this.probarValidacionEmail(email);
      } else {
        throw new Error(`Servidor no responde: ${response.status}`);
      }
    })
    .catch(error => {
      console.error('❌ Error en test:', error);
      this.loading = false;
      
      if (error.message.includes('Timeout')) {
        this.errorMsg = 'El servidor no responde. Verifica que esté funcionando.';
      } else {
        this.errorMsg = `Error de conexión: ${error.message}`;
      }
      
      this.cdr.detectChanges();
    });
  }

  // Método auxiliar para probar la validación de email
  probarValidacionEmail(email: string) {
    console.log('🔍 Probando validación de email...');
    
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout en validación: La base de datos está lenta')), 15000)
    );
    
    const fetchPromise = fetch('http://localhost:3000/api/validar-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email })
    });
    
    return Promise.race([fetchPromise, timeoutPromise])
    .then((response: any) => {
      console.log('📡 Validación response:', response);
      console.log('📡 Validación status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    })
    .then(data => {
      console.log('📋 Validación data:', data);
      console.log('✅ Email válido, cambiando a paso password');
      
      this.loading = false;
      this.emailValidado = email;
      this.currentStep = 'password';
      this.successMsg = '✅ Correo electrónico válido. Ahora puedes cambiar tu contraseña.';
      this.cdr.detectChanges();
      console.log('🔄 Paso actual:', this.currentStep);
    })
    .catch(error => {
      console.error('❌ Error en validación de email:', error);
      this.loading = false;
      
      if (error.message.includes('Timeout')) {
        this.errorMsg = 'La base de datos está tardando mucho en responder. Intenta más tarde.';
      } else {
        this.errorMsg = `Error: ${error.message}`;
      }
      
      this.cdr.detectChanges();
    });
  }

  // Paso 2: Actualizar contraseña
  async actualizarContrasena() {
    if (this.passwordForm.invalid) {
      if (this.passwordForm.errors?.['passwordMismatch']) {
        this.errorMsg = 'Las contraseñas no coinciden';
      } else {
        this.errorMsg = 'Por favor, completa todos los campos correctamente (mínimo 6 caracteres)';
      }
      return;
    }

    console.log('🔑 Iniciando actualización de contraseña...');
    this.loading = true;
    this.errorMsg = '';
    this.successMsg = '';
    const nuevaContrasena = this.passwordForm.get('nuevaContrasena')?.value;

    try {
      const response = await fetch('http://localhost:3000/api/actualizar-contrasena', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: this.emailValidado, 
          nuevaContrasena 
        })
      });

      const data = await response.json();
      console.log('🔑 Response data:', data);

      if (response.ok) {
        console.log('✅ Contraseña actualizada exitosamente');
        this.loading = false;
        this.successMsg = '🎉 ¡Contraseña actualizada exitosamente!';
        this.cdr.detectChanges();
        
        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          this.volverAlLogin();
        }, 2000);
      } else {
        this.loading = false;
        this.errorMsg = data.message || 'Error al actualizar la contraseña';
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('❌ Error al actualizar contraseña:', error);
      this.loading = false;
      this.errorMsg = 'Error de conexión con el servidor';
      this.cdr.detectChanges();
    }
  }

  // Volver al paso del email
  volverAEmail() {
    this.currentStep = 'email';
    this.errorMsg = '';
    this.successMsg = '';
    this.passwordForm.reset();
  }

  volverAlLogin() {
    this.router.navigate(['/acceso']);
  }

  // Getters para facilitar el acceso en el template
  get email() { return this.emailForm.get('email'); }
  get nuevaContrasena() { return this.passwordForm.get('nuevaContrasena'); }
  get confirmarContrasena() { return this.passwordForm.get('confirmarContrasena'); }
}
