import { ApplicationConfig, importProvidersFrom, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { ToastrModule } from 'ngx-toastr';

// On enregistre les données locales françaises
registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
    provideAnimations(),
    importProvidersFrom(
      ToastrModule.forRoot({
        positionClass: 'toast-bottom-right',
        timeOut: 4000,
        closeButton: true,
        progressBar: true,
        preventDuplicates: true
      })
    ),
    { provide: LOCALE_ID, useValue: 'fr-FR' }, // <-- définit la langue globale
  ]
};
