import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, distinctUntilChanged, map, Observable, of, Subject, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Post } from '../../features/dashboard/data-access/post.model';
import { WriterPost } from '../../features/dashboard/data-access/writer.models';
import { UserProfile } from '../../features/dashboard/data-access/profile.model';

// export interface AiSearchResponse {
//   query: string;
//   expanded_query: string;
//   similar_docs: Array<{ uuid: string; title: string; description: string; score: number }>;
//   relevant_ext_docs: Array<{ title: string; url: string; snippet: string }>;
// }
export interface ExternalDoc {
  source_url: string;
  source_name: string;
  source_small_headline: string;
  source_small_description: string;
  favicon: string;
}

export interface SimilarDoc {
  uuid: string;
  title: string;
  description: string;
  score: number;
}

export interface AiSearchResponse {
  query: string;
  expanded_query: string;
  similar_docs: SimilarDoc[];
  relevant_ext_docs: ExternalDoc[];
}

@Injectable({
  providedIn: 'root',
})
export class RemoteApi {
  private baseUrl = environment.nodeServiceUrl;

  private dataChangedTrigger = new Subject<void>();
  dataChanged$ = this.dataChangedTrigger.asObservable();

  private isAvailableSubject = new BehaviorSubject<boolean>(true);
  isAvailable$ = this.isAvailableSubject.asObservable().pipe(distinctUntilChanged());

  constructor(private http: HttpClient) { }

  setAvailability(status: boolean) {
    this.isAvailableSubject.next(status);
  }

  checkHealth(): Observable<boolean> {
    return this.http.get<any>(`${this.baseUrl}/health`).pipe(
      map((res) => {
        const isAvailable = res.status === 'UP' || res.status === 'DEGRADED';
        this.isAvailableSubject.next(isAvailable);
        return isAvailable;
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
  fetchPublicPosts(page: number = 0, limit: number = 5, query: string = '', mode: 'keyword' | 'hybrid' = 'hybrid'): Observable<{ posts: Post[], proposedLinks: any[] }> {
    const skip = page * limit;
    const effectiveMode = mode === 'keyword' ? 'lexical' : 'hybrid';
    const request$ = query
      ? this.http.get<any>(`${this.baseUrl}/api/search?q=${query}&limit=${limit}&mode=${effectiveMode}`).pipe(
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
        const message = err.error?.message || err.message || 'Connection error';
        console.error('RemoteApi fetch error:', message);
        throw new Error(message);
      })
    );
  }

  private mapPosts(serverPosts: any[]): Post[] {
    return serverPosts.map(p => this.mapPost(p));
  }

  private mapPost(p: any): Post {
    return {
      uuid: p.uuid,
      title: p.title,
      description: p.description,
      createdAt: new Date(p.lastEditedAt || Date.now()),
      lastModifiedAt: p.lastEditedAt ? new Date(p.lastEditedAt) : null,
      isPublic: p.isPublic !== undefined ? p.isPublic : true,
      createdBy: p.authorName || 'Unknown',
      imageUrl: p.images && p.images.length > 0 ? p.images[0] : null,
      // pass-through backend fields for UI enrichment
      authorName: p.authorName,
      authorAvatar: p.authorAvatar,
      images: p.images || [],
      hashtags: p.hashtags || [],
      isDraft: p.isDraft,
      lastEditedAt: p.lastEditedAt,
      views: p.views,
      slug: p.slug,
      publishedAt: p.publishedAt,
      readTime: p.readTime,
    };
  }

  fetchPostByUuid(uuid: string): Observable<Post> {
    return this.http.get<any>(`${this.baseUrl}/api/posts/${uuid}`).pipe(
      map(p => this.mapPost(p)),
      catchError(err => {
        const message = err.error?.message || err.message || 'Post not found';
        console.error('Fetch post error:', message);
        throw new Error(message);
      })
    );
  }

  fetchPostBySlug(slug: string): Observable<Post> {
    return this.http.get<any>(`${this.baseUrl}/api/posts/slug/${slug}`).pipe(
      map(p => this.mapPost(p)),
      catchError(err => {
        const message = err.error?.message || err.message || 'Post not found';
        console.error('Fetch post by slug error:', message);
        throw new Error(message);
      })
    );
  }

  fetchWriterPosts(page = 1, limit = 20): Observable<WriterPost[]> {
    return this.http.get<any[]>(
      `${this.baseUrl}/myactivity/posts?page=${page}&limit=${limit}`
    ).pipe(map(posts => posts.map(p => this.mapToWriterPost(p))));
  }

  /**
   * Single-trip loader for WriterProfile.
   * One HTTP call — server already aggregates via Promise.allSettled.
   * Maps res.data.* and renames API fields to match Angular model (avatarUrl→avatar, useruuid→id).
   */
  fetchFullProfile(): Observable<{ profile: UserProfile; drafts: WriterPost[]; favs: Post[] }> {
    return this.http.get<any>(`${this.baseUrl}/profile/me/full-profile`).pipe(
      map(res => ({
        profile: {
          id:             res.data.profile.useruuid,
          name:           res.data.profile.name,
          bio:            res.data.profile.bio || '',
          avatar:         res.data.profile.avatarUrl || null,
          stats:          res.data.stats,
          savedInsights:  [],
          recentActivity: [],
        } as UserProfile,
        drafts: (res.data.drafts    || []).map((p: any) => this.mapToWriterPost(p)),
        favs:   (res.data.favorites || []).map((p: any) => this.mapPost(p)),
      }))
    );
  }

  private mapToWriterPost(p: any): WriterPost {
    return {
      uuid:         p.uuid,
      title:        p.title,
      description:  p.description,
      hashtags:     p.hashtags     || [],
      images:       p.images       || [],
      status:       p.isDraft ? 'draft' : 'published',
      lastEditedAt: p.lastEditedAt || p.createdAt,
      publishedAt:  p.publishedAt,
      views:        p.views,
      readTime:     p.readTime,
      authorName:   p.authorName,
      authorAvatar: p.authorAvatar,
    };
  }

  // Create post
  createPost(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/myactivity/posts`, data).pipe(
      tap(() => this.dataChangedTrigger.next())
    );
  }

  // Update post
  updatePost(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/myactivity/posts/${id}`, data).pipe(
      tap(() => this.dataChangedTrigger.next())
    );
  }

  // Favorite post
  favoritePost(id: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/posts/${id}/favorite`, {});
  }

  // Delete post
  deletePost(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/myactivity/posts/${id}`).pipe(
      tap(() => this.dataChangedTrigger.next())
    );
  }

  // Analytics
  logAnalyticsEvent(event: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/analytics/events`, event);
  }

  logAnalyticsBatch(events: any[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/analytics/batch`, { events });
  }

  subscribeNewsletter(email: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/newsletter`, { email });
  }

  fetchAiResults(query: string, limit = 5): Observable<AiSearchResponse> {
    return this.http.post<AiSearchResponse>(
      `${this.baseUrl}/api/search/ai`,
      { query, limit }
    ).pipe(
      catchError((err) => {
        console.error('AI Search Error:', err);
        return throwError(() => new Error('AI search unavailable'));
      })
    );
  }

  searchTags(query: string): Observable<string[]> {
    return this.http.get<{ query: string; results: string[] }>(
      `${this.baseUrl}/api/tags/search`,
      { params: { q: query } }
    ).pipe(
      map(res => res.results),
      catchError(() => of([]))
    );
  }

  getAllTags(): Observable<string[]> {
    return this.http.get<{ tags: string[] }>(`${this.baseUrl}/api/tags`).pipe(
      map(res => res.tags),
      catchError(() => of([]))
    );
  }
}
