import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptorInterceptor: HttpInterceptorFn = (req, next) => {
  //next iteration we will keep the accessotken as a var in authservice and refreshtoken in the httponly cookie to be use to get a new accesstoken
  const token = localStorage.getItem('token');
  if(token){
    const authReq = req.clone({
      setHeaders:{Authorization: `Bearer ${token}`}
    });
    return next(authReq);
  }
  return next(req);
};
