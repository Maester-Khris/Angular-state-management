import { Injectable } from '@angular/core';
import { delay, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  getProfile(userid: string){
    console.log(".... fetching the user profile from remote api");
    return of({
      id: userid,
      name:"Niki OPS",
      bio:"The Mother Fucking CREDOPS agent",
      avatar:"assets/avatar.png",
      stats: { posts: 0, reach: "", coAuth: 0, since: 120 },
      savedInsights: [],
      recentActivity: [],
    }).pipe(delay(800));
  }
}

//  id: string,
//   name: string,
//   bio: string,stats: { posts: number; reach: string; coAuth: number; since: number };
//   savedInsights: any[];
//   recentActivity: any[];
//   avatar: string|null,
  
