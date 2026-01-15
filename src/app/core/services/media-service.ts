import { Injectable } from '@angular/core';
import { EMPTY, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  
  uploadImage(image: File): Observable<any>{
    return EMPTY;
  }
}
