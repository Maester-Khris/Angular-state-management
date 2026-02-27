import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
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
    formData.append('file', file);

    return this.http.post<{ message: string, url: string }>(
      `${this.baseUrl}/myactivity/upload`,
      formData
    ).pipe(
      catchError((err: HttpErrorResponse) => {
        const message = err.error?.message || err.message || 'Failed to upload image';
        console.error('MediaService upload error:', message);
        return throwError(() => new Error(message));
      })
    );
  }
}
