import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs';
import { RemoteApi } from './remote-api';

@Injectable({ providedIn: 'root' })
export class TagService {
  private readonly remoteApi = inject(RemoteApi);
  private readonly TTL = 5 * 60 * 1000;
  private cache = new Map<string, { results: string[]; timestamp: number }>();

  private key(query: string): string {
    return query.toLowerCase().trim();
  }

  getCached(query: string): string[] | null {
    const entry = this.cache.get(this.key(query));
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(this.key(query));
      return null;
    }
    return entry.results;
  }

  setCache(query: string, results: string[]): void {
    this.cache.set(this.key(query), { results, timestamp: Date.now() });
  }

  search(query: string): Observable<string[]> {
    const cached = this.getCached(query);
    if (cached) return of(cached);
    return this.remoteApi.searchTags(query).pipe(
      tap(results => this.setCache(query, results))
    );
  }

  clearCache(): void {
    this.cache.clear();
  }
}
