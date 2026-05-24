import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, from, Observable, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UploadResult {
  url:      string;
  publicId: string;
  mediaId:  string;
  exists:   boolean;
}

@Injectable({
  providedIn: 'root',
})
export class MediaService {

  private baseUrl = environment.nodeServiceUrl;

  constructor(private http: HttpClient) { }

  async hashFile(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  uploadImage(file: File, type: 'post' | 'profile' = 'post'): Observable<UploadResult> {
    return from(this.hashFile(file)).pipe(
      switchMap(hash => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('hash', hash);
        return this.http.post<UploadResult>(
          `${this.baseUrl}/myactivity/upload?type=${type}`,
          formData
        );
      }),
      catchError((err: HttpErrorResponse) => {
        const message = err.error?.message || err.message || 'Failed to upload image';
        console.error('MediaService upload error:', message);
        return throwError(() => new Error(message));
      })
    );
  }
}
