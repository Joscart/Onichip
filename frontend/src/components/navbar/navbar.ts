import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css']
})
export class NavbarComponent {
  @Input() userName: string = '';
  @Input() showUserActions: boolean = true;
  @Input() showBackButton: boolean = false;
  @Input() backRoute: string = '/home';
  @Input() title: string = 'OnichipGPS';
  
  @Output() logout = new EventEmitter<void>();
  @Output() navigateToRegister = new EventEmitter<void>();
  @Output() navigateBack = new EventEmitter<void>();

  constructor(private router: Router) {}

  onLogout() {
    this.logout.emit();
  }

  onNavigateToRegister() {
    this.navigateToRegister.emit();
  }

  onNavigateBack() {
    if (this.navigateBack.observers.length > 0) {
      this.navigateBack.emit();
    } else {
      this.router.navigate([this.backRoute]);
    }
  }
}
