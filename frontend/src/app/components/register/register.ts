import { Component } from '@angular/core';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-register',
  standalone: false,
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  user: { nombre: string; apellido: string; apodo: string; password: string; devices?: any[] } = { nombre: '', apellido: '', apodo: '', password: '', devices: [] };
  deviceId = '';
  nickname = '';
  error = '';
  success = '';
  showDeviceForm = false;

  constructor(private api: ApiService) {}

  addDevice() {
    if (this.deviceId) {
      if (!this.user.devices) this.user.devices = [];
      this.user.devices.push({ deviceId: this.deviceId, nickname: this.nickname });
      this.deviceId = '';
      this.nickname = '';
    }
  }

  onRegister() {
    this.error = '';
    this.success = '';
    // Si no hay dispositivos, enviar el usuario sin el array
    const userToSend = { ...this.user };
    if (!userToSend.devices || !userToSend.devices.length) {
      delete userToSend.devices;
    }
    this.api.register(userToSend).subscribe({
      next: res => {
        this.success = 'Usuario registrado correctamente';
        this.user = { nombre: '', apellido: '', apodo: '', password: '', devices: [] };
        this.showDeviceForm = false;
      },
      error: err => {
        this.error = err.error?.error || 'Error en el registro';
      }
    });
  }
}
