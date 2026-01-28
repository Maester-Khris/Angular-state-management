import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RemoteApi {
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) { }

  // Get initial feed
  getInitialFeed(limit: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/feed?limit=${limit}`);
  }

  // Get next batch
  getNextBatch(cursor: string, limit: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/feed?cursor=${cursor}&limit=${limit}`);
  }

  // Create post
  createPost(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/posts`, data);
  }

  // Update post
  updatePost(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/posts/${id}`, data);
  }

  // Favorite post
  favoritePost(id: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/posts/${id}/favorite`, {});
  }

  // Delete post
  deletePost(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/posts/${id}`);
  }
}
