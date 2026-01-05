import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, concatMap, debounceTime, delay, distinctUntilChanged, exhaustMap, filter, from, map, merge, mergeMap, Observable, of, pairwise, shareReplay, startWith, Subject, switchMap, tap, timer } from 'rxjs';
import { MockApi } from '../../core/services/mock-api';
import { Post } from '../posts/data-access/post.model';

@Component({
  selector: 'app-home',
  imports: [FormsModule, CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, OnDestroy {
  private readonly MockApi = inject(MockApi);

  //make home reactive to change in global posts
  posts$ = this.MockApi.dataChanged$.pipe(
    switchMap(() => this.MockApi.fetchPublicPosts()),
    shareReplay(1) // Avoid multiple API calls for the same data
  );

  searchQuery = new Subject<string>(); 
  filteredPost$ = this.searchQuery.pipe(
    startWith(''),
    debounceTime(500),
    distinctUntilChanged(),
    switchMap((query:string) => 
      this.posts$.pipe(
        map(posts => {
          const searchTerm = query.toLowerCase().trim();
          if(!searchTerm) return posts;

          return posts.filter((post:Post) => 
            post.title.toLowerCase().includes(query) || 
            post.description.toLowerCase().includes(query)
          );
        }) 
      )
    )
  );

  ngOnInit(): void {
    // this.posts$ = this.MockApi.fetchPublicPosts();
    // this.refreshTrigger$.next();
  }
  

  onSearch(event:Event) {
    const value = (event.target as HTMLInputElement).value; 
    this.searchQuery.next(value);
  }

  ngOnDestroy(): void {
  }

}
