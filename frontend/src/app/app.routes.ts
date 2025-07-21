import { Routes } from '@angular/router';
import { Home } from '../components/home/home';
import { Acceso } from '../components/acceso/acceso';
import { Homeusuario } from '../components/homeusuario/homeusuario';
import { Registro } from '../components/registro/registro';
import { Registromascota } from '../components/registromascota/registromascota';
import { Recuperacion } from '../components/recuperacion/recuperacion';
import { Admin } from '../components/admin/admin';


export const routes: Routes = [
    {
        path: '',
        component: Home
    },
    {
        path: 'acceso',
        component: Acceso
    },
    {
        path: 'registro',
        component: Registro
    },
    {
        path: 'registromascota',
        component: Registromascota
    },
    {
        path: 'homeusuario',
        component: Homeusuario
    },
    {
        path: 'home',
        component: Home
    },
    {
        path: 'recuperacion',
        component: Recuperacion
    },
    {
        path: 'admin',
        component: Admin
    }
];
