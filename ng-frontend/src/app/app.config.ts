import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideAppInitializer, inject } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { errorInterceptorInterceptor } from './core/interceptors/error-interceptor-interceptor';
import { authInterceptorInterceptor } from './core/interceptors/auth-interceptor-interceptor';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from './core/services/app-config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(
      withHttpTransferCacheOptions({
        includePostRequests: false // we use intial server send cache for get request
      })
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([errorInterceptorInterceptor, authInterceptorInterceptor])
    ),
    provideAppInitializer(() => {
      const configSvc = inject(AppConfigService);
      return firstValueFrom(configSvc.load());
    }),
  ]
};
