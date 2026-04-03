import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AppConfig {
    features: {
        aiSearch: boolean;
    };
}

@Injectable({
    providedIn: 'root',
})
export class AppConfigService {
    private http = inject(HttpClient);
    private baseUrl = environment.nodeServiceUrl;

    // Signal holding the resolved config
    // Default: all features off until server confirms otherwise
    readonly config = signal<AppConfig>({
        features: { aiSearch: false },
    });

    load(): Observable<AppConfig> {
        return this.http.get<AppConfig>(`${this.baseUrl}/api/config`).pipe(
            tap((cfg) => this.config.set(cfg)),
            catchError((err) => {
                // On failure keep defaults (all off) — safe degradation
                console.warn('AppConfig load failed — defaulting all features to off', err);
                return of(this.config());
            })
        );
    }
}
