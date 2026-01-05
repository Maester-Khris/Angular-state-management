import { Component, input } from '@angular/core';
import { Post } from '../../../features/posts/data-access/post.model';

@Component({
  selector: 'app-post-card',
  imports: [],
  templateUrl: './post-card.html',
  styleUrl: './post-card.css',
})
export class PostCard {
post = input.required<Post>();
}
