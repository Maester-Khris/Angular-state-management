import { Injectable } from '@angular/core';
import { BehaviorSubject, concatMap, debounceTime, delay, exhaustMap, from, map, merge, mergeMap, Observable, of, pairwise, switchMap, tap, timer } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RxjsTraining {
  skills: string[] = ["backend", "frontend", "fullstack", "databse"];
  languages: string[] = ["java", "javascript", "php", "python"];

  skills$: Observable<String> = from(this.skills);
  langs$: Observable<String> = from(this.languages);
  authStatus = new BehaviorSubject<String>("logged out");

   ngAfterViewInit(): void {
    // this.skills$.pipe(
    //   concatMap(skill => // project element from the source observable into the new one
    //     timer(2000).pipe( // timer create a new observable
    //       map(() => `new skill: ${skill}`),
    //     )
    //   )
    // ).subscribe(s => console.log('received element', s));

    // let combined$ = merge(
    //   this.skills$.pipe(tap(s => console.log(`skills: ${s}`), delay(1000))),
    //   this.langs$.pipe(tap(l => console.log(`language: ${l}`), delay(2000))),
    // ).subscribe(val => console.log("received val", val));

    // setTimeout(() => {
    //   this.authStatus.next("signed in");
    // }, 3000);

    // this.authStatus.pipe(
    //   pairwise()
    // ).subscribe(([prev, current])=>{
    //   console.log(`prev value ${prev} - current ${current}`)
    // })

    // operators: big four, combine latest, debouncetime, timer, delay
    // The input: A stream of IDs triggered almost instantly
    const ids$ = of(1, 2, 3); 

    // The Mock API: Returns a string after 1 second
    const mockApi = (id: number) => of(`Result for ${id}`).pipe(
      delay(1000) // Simulates network latency
    );

    const fireAndForget = (id: number) => of(`Request for ${id}`).pipe(
      delay(800) // Simulates network latency
    );

    const searchById = (id: number) => of(`Filtering for ${id}`).pipe(
      debounceTime(800) // Simulates network latency
    );

    ids$.pipe(
      // concatMap((id) => mockApi(id))
      // mergeMap(id => fireAndForget(id))
      // switchMap(id => searchById(id))
      exhaustMap(id => mockApi(id))
    ).subscribe(console.log) ;

  }
}
