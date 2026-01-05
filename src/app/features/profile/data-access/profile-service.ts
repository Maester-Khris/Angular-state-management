import { Injectable } from '@angular/core';
import { delay, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  getProfile(userid: string){
    console.log(".... fetching the user profile from remote api");
    return of({
      id:userid,
      name:"Niki OPS",
      bio:"The Mother Fucking CREDOPS agent",
      avatar:"assets/avatar.png",
    }).pipe(delay(800));
  }
}
