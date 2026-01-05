import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UserProfile } from './data-access/profile.model';

@Component({
  selector: 'app-profile',
  imports: [],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit{
  private route = inject(ActivatedRoute);
  profile!:UserProfile;

  ngOnInit(): void {
    this.profile = this.route.snapshot.data['profileData'];
  }
}
