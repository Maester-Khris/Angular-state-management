import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UserProfile } from './data-access/profile.model';
import { MockApi } from '../../core/services/mock-api';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  imports: [CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit{
  private route = inject(ActivatedRoute);
  private mockApi = inject(MockApi);
  profileinit!:UserProfile;

  ngOnInit(): void {
    this.profileinit = this.route.snapshot.data['profileData'];
  }

  profile = toSignal(this.mockApi.fetchUserProfile(), {
    initialValue: {} as UserProfile
  });

  drafts = toSignal(this.mockApi.fetchDrafts(), {
    initialValue: [] as any[]
  });

  favs = toSignal(this.mockApi.fetchSavedInsights(), {
    initialValue: [] as any[]
  });

  contributionData = toSignal(this.mockApi.fetchContributionData(), {
    initialValue: [] as number[]
  });

  account_activity = toSignal(this.mockApi.fetchRecentActivity(), {
    initialValue: [] as any[]
  });
}
