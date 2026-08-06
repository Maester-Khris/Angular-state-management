import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RemoteApi } from '../../../core/services/remote-api';
import { UserProfile } from '../data-access/profile.model';
import { WriterPost } from '../data-access/writer.models';
import { Post } from '../data-access/post.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-writer-profile',
  imports: [CommonModule, RouterOutlet],
  templateUrl: './writer-profile.html',
  styleUrl: './writer-profile.css',
})
export class WriterProfile implements OnInit {
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private remoteApi  = inject(RemoteApi);
  private destroyRef = inject(DestroyRef);

  profile          = signal<UserProfile | null>(null);
  drafts           = signal<WriterPost[]>([]);
  favs             = signal<Post[]>([]);
  contributionData = signal<number[]>([]);
  account_activity = signal<any[]>([]);
  isLoading        = signal(true);

  featureFlags = environment.featureFlags;

  /** CSS initials fallback — shown when profile.avatar is null/empty. */
  protected initials = computed(() => {
    const name = this.profile()?.name ?? '';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  });

  ngOnInit(): void {
    this.remoteApi.fetchFullProfile().pipe(
      catchError(() => of({ profile: null, drafts: [], favs: [] })),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ profile, drafts, favs }) => {
      this.profile.set(profile);
      this.drafts.set(drafts);
      this.favs.set(favs);
      this.isLoading.set(false);
    });
  }

  openDraftInConsole(draft: WriterPost): void {
    this.router.navigate(['/dashboard/myactivity'], { state: { editDraft: draft } });
  }
}
