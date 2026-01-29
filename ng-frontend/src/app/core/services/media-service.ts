import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { EMPTY, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MediaService {

  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }
  
   // Upload image
  uploadImage(file: File): Observable<{ message: string, url: string }> {
    const formData = new FormData();
    formData.append('file', file); // 'file' must match the name in upload.single('file') in Node

    // Note: Do NOT add headers here. The browser needs to set the multipart boundary.
    return this.http.post<{ message: string, url: string }>(
      `${this.baseUrl}/myactivity/upload`, 
      formData
    );
  }
}
