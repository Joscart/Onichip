import { Component } from '@angular/core';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-user',
  standalone: false,
  templateUrl: './user.html',
  styleUrl: './user.css'
})
export class User {
  user: any = null;
  editMode = false;
  editUser: any = {};

  constructor(private api: ApiService) {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      this.user = JSON.parse(userStr);
    }
  }

  // Habilitar edición
  enableEdit() {
    this.editMode = true;
    this.editUser = { ...this.user };
  }

  // Guardar cambios
  saveEdit() {
    if (!this.user || !this.user._id) return;
    this.api.updateUser(this.user._id, this.editUser).subscribe({
      next: res => {
        this.user = { ...this.editUser };
        localStorage.setItem('user', JSON.stringify(this.user));
        this.editMode = false;
      },
      error: () => {
        // Si falla, solo actualiza local
        this.user = { ...this.editUser };
        localStorage.setItem('user', JSON.stringify(this.user));
        this.editMode = false;
      }
    });
  }

  // Cancelar edición
  cancelEdit() {
    this.editMode = false;
  }
}
