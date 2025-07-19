import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {
  isLoggedIn = false;

  constructor() {
    // Aquí puedes implementar la lógica real de sesión (ejemplo: revisar localStorage)
    const token = localStorage.getItem('token');
    this.isLoggedIn = !!token;
  }
}
