import { NgModule, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing-module';
import { RouterModule } from '@angular/router';
import { App } from './app';
import { Home } from './components/home/home';
import { Login } from './components/login/login';
import { Register } from './components/register/register';
import { User } from './components/user/user';
import { Devices } from './components/devices/devices';
import { Navbar } from './components/navbar/navbar';

@NgModule({
  declarations: [
    App,
    Home,
    Login,
    Register,
    User,
    Devices,
    Navbar
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    RouterModule
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection()
  ],
  bootstrap: [App]
})
export class AppModule { }
