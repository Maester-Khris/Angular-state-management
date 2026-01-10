import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        console.warn('Unauthorized! Redirecting...');
      }
      
      if (error.status >= 500) {
        console.error('Server side error detected');
      }
      
      return throwError(() => error);
    })
  );
};
