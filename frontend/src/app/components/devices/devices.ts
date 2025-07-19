import { Component, OnDestroy } from '@angular/core';
import { ApiService } from '../../api.service';
import { io, Socket } from 'socket.io-client';

@Component({
  selector: 'app-devices',
  standalone: false,
  templateUrl: './devices.html',
  styleUrl: './devices.css'
})
export class Devices implements OnDestroy {
  devices: any[] = [];
  selectedDeviceId: string = '';
  selectedDevice: any = null;
  deviceId = '';
  nickname = '';
  error = '';
  success = '';
  userId = '';
  socket: Socket | null = null;

  constructor(private api: ApiService) {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      this.userId = user._id;
      this.refreshDevices();
      // Conexión a Socket.IO para actualizaciones en tiempo real
      this.socket = io('http://localhost:3000'); // Cambia el puerto si tu backend usa otro
      this.socket.on('devicesUpdated', (data: any) => {
        if (data.userId === this.userId) {
          this.refreshDevices();
        }
      });
    }
  }
  ngOnDestroy() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  refreshDevices() {
    if (!this.userId) return;
    this.api.getUserDevices(this.userId).subscribe({
      next: devices => {
        this.devices = devices;
        // Actualizar usuario en localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          user.devices = devices;
          localStorage.setItem('user', JSON.stringify(user));
        }
      }
    });
  }

  onSelectDevice() {
    if (!this.selectedDeviceId) {
      this.selectedDevice = null;
      return;
    }
    this.api.getDeviceByDeviceId(this.selectedDeviceId).subscribe({
      next: device => {
        this.selectedDevice = device;
      },
      error: () => {
        this.selectedDevice = null;
      }
    });
  }

  addDevice() {
    this.error = '';
    this.success = '';
    if (!this.deviceId) {
      this.error = 'Debes ingresar un Device ID.';
      return;
    }
    this.api.addDevice(this.userId, { deviceId: this.deviceId, nickname: this.nickname }).subscribe({
      next: devices => {
        this.success = 'Dispositivo agregado correctamente.';
        this.deviceId = '';
        this.nickname = '';
        this.refreshDevices();
      },
      error: err => {
        this.error = err.error?.error || 'Error al agregar dispositivo.';
      }
    });
  }
}
