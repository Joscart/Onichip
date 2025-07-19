import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: false,
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  isLoggedIn = false;
  constructor(private router: Router) {}

  ngOnInit() {
    this.checkLogin();
    window.addEventListener('storage', () => this.checkLogin());
  }

  checkLogin() {
    const token = localStorage.getItem('token');
    this.isLoggedIn = !!token && token !== 'false';
  }

  goToHome() {
    this.router.navigate(['/']);
  }
  goToLogin() {
    this.router.navigate(['/login']);
  }
  goToRegister() {
    this.router.navigate(['/register']);
  }
  goToUser() {
    this.router.navigate(['/user']);
  }
  goToDevices() {
    this.router.navigate(['/devices']);
  }
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.checkLogin();
    this.router.navigate(['/']);
  }
}
