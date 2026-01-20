import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID, REQUEST } from '@angular/core';
import { AuthService, parseCookie } from '../services/auth-service';
import { isPlatformServer } from '@angular/common';

export const authInterceptorInterceptor: HttpInterceptorFn = (req, next) => {
  //next iteration we will keep the accessotken as a var in authservice and refreshtoken in the httponly cookie to be use to get a new accesstoken
  // const token = localStorage.getItem('token');
  const platformId = inject(PLATFORM_ID);
  const authService = inject(AuthService);
  let token:string|null = null;

  if(isPlatformServer(platformId)){
    const serverRequest = inject(REQUEST, { optional: true }); 
    const cookies = serverRequest?.headers?.get('cookie') ?? null;
    token = cookies ? parseCookie(cookies, 'accessToken') : null; // Only attempt to parse if cookies exist
  }else{ 
    token = authService.getAccessToken();
  }

 if (token) {
    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(authReq);
  }
  return next(req);
};

