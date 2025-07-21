import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class Home {
title = 'Onichip Mascotas';
  mascotas = [
    {
      nombre: 'Max',
      descripcion: 'Un perro juguetón y amigable.',
      img: 'https://placedog.net/80/80'
    },
    {
      nombre: 'Luna',
      descripcion: 'Gata curiosa y cariñosa.',
      img: 'https://placekitten.com/80/80'
    },
    {
      nombre: 'Teddy',
      descripcion: 'Oso de peluche, el mejor amigo.',
      img: 'https://placebear.com/80/80'
    }
  ];
}
