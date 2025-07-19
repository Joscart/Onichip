// ...existing code...
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  // Auth
  register(user: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/user/register`, user);
  }
  login(credentials: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/user/login`, credentials);
  }

  // User update
  updateUser(userId: string, userData: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/user/${userId}`, userData);
  }

  // User Devices
  getUserDevices(userId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/user/${userId}/devices`);
  }
  addDevice(userId: string, device: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/user/${userId}/devices`, device);
  }
  updateDeviceNickname(userId: string, deviceMongoId: string, nickname: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/user/${userId}/devices/${deviceMongoId}`, { nickname });
  }

  // Devices Dashboard
  getDevices(): Observable<any> {
    return this.http.get(`${this.baseUrl}/device`);
  }
  getDeviceById(_id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/device/${_id}`);
  }
  getDeviceByDeviceId(deviceId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/device/dev/${deviceId}`);
  }
  addDeviceGlobal(device: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/device`, device);
  }
  updateDevice(_id: string, device: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/device/${_id}`, device);
  }
  deleteDevice(_id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/device/${_id}`);
  }
  deleteDeviceByDeviceId(deviceId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/device/dev/${deviceId}`);
  }
}
