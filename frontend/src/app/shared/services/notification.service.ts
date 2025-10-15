import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private toastr: ToastrService) {}

  success(message: string, title: string = 'Succès'): void {
    this.toastr.success(message, title);
  }

  error(message: string, title: string = 'Erreur'): void {
    this.toastr.error(message, title);
  }

  info(message: string, title: string = 'Info'): void {
    this.toastr.info(message, title);
  }

  warning(message: string, title: string = 'Attention'): void {
    this.toastr.warning(message, title);
  }
}
