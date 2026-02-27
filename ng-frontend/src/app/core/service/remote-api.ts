import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, distinctUntilChanged, map, Observable, of, Subject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Post } from '../../features/posts/data-access/post.model';

@Injectable({
  providedIn: 'root',
})
export class RemoteApi {
  private baseUrl = environment.apiUrl;

  private dataChangedTrigger = new Subject<void>();
  dataChanged$ = this.dataChangedTrigger.asObservable();

  private isAvailableSubject = new BehaviorSubject<boolean>(true);
  isAvailable$ = this.isAvailableSubject.asObservable().pipe(distinctUntilChanged());

  constructor(private http: HttpClient) { }

  setAvailability(status: boolean) {
    this.isAvailableSubject.next(status);
  }

  checkHealth(): Observable<boolean> {
    return this.http.get(`${this.baseUrl}/health`).pipe(
      map(() => {
        this.isAvailableSubject.next(true);
        return true;
      }),
      catchError(() => {
        this.isAvailableSubject.next(false);
        return of(false);
      })
    );
  }

  // Get initial feed
  getInitialFeed(limit: number = 5): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/feed?limit=${limit}`);
  }

  // Get next batch
  getNextBatch(cursor: string, limit: number = 5): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/feed?cursor=${cursor}&limit=${limit}`);
  }

  /**
   * Home page requirement: Fetch public posts with pagination and search
   */
  fetchPublicPosts(page: number = 0, limit: number = 5, query: string = ''): Observable<{ posts: Post[], proposedLinks: any[] }> {
    const skip = page * limit;
    const request$ = query
      ? this.http.get<any>(`${this.baseUrl}/api/search?q=${query}&limit=${limit}`).pipe(
        map(res => ({
          posts: this.mapPosts(res.results || []),
          proposedLinks: res.proposedLinks || []
        }))
      )
      : this.http.get<any>(`${this.baseUrl}/api/feed?limit=${limit}&skip=${skip}`).pipe(
        map(res => ({
          posts: this.mapPosts(res.posts || res.data || []),
          proposedLinks: res.proposedLinks || []
        }))
      );

    return request$.pipe(
      tap(() => this.setAvailability(true)),
      catchError(err => {
        console.error('RemoteApi fetch error:', err);
        throw err;
      })
    );
  }

  private mapPosts(serverPosts: any[]): Post[] {
    return serverPosts.map(p => ({
      uuid: p.uuid,
      title: p.title,
      description: p.description,
      createdAt: new Date(p.lastEditedAt || Date.now()),
      lastModifiedAt: p.lastEditedAt ? new Date(p.lastEditedAt) : null,
      isPublic: p.isPublic !== undefined ? p.isPublic : true,
      createdBy: p.authorName || 'Unknown',
      imageUrl: p.images && p.images.length > 0 ? p.images[0] : 'https://via.placeholder.com/150'
    }));
  }

  fetchPostByUuid(uuid: string): Observable<Post> {
    return this.http.get<any>(`${this.baseUrl}/api/posts/${uuid}`).pipe(
      map(p => ({
        uuid: p.uuid,
        title: p.title,
        description: p.description,
        createdAt: new Date(p.lastEditedAt || Date.now()),
        lastModifiedAt: p.lastEditedAt ? new Date(p.lastEditedAt) : null,
        isPublic: p.isPublic !== undefined ? p.isPublic : true,
        createdBy: p.authorName || 'Unknown',
        imageUrl: p.images && p.images.length > 0 ? p.images[0] : 'https://via.placeholder.com/150'
      }))
    );
  }

  // Create post
  createPost(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/posts`, data).pipe(
      tap(() => this.dataChangedTrigger.next())
    );
  }

  // Update post
  updatePost(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/posts/${id}`, data).pipe(
      tap(() => this.dataChangedTrigger.next())
    );
  }

  // Favorite post
  favoritePost(id: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/posts/${id}/favorite`, {});
  }

  // Delete post
  deletePost(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/posts/${id}`).pipe(
      tap(() => this.dataChangedTrigger.next())
    );
  }
}
