import { Injectable } from '@angular/core';
import { BehaviorSubject, delay, map, Observable, of, Subscriber, throwError } from 'rxjs';
import { Post } from '../../features/posts/data-access/post.model';

@Injectable({
  providedIn: 'root',
})
export class MockApi {
  private dataChangedTrigger = new BehaviorSubject<void>(undefined);
  dataChanged$ = this.dataChangedTrigger.asObservable();

  MOCK_POSTS: Post[] = [
  {
    title: "Understanding Promises in JavaScript",
    description: "A comprehensive guide to JavaScript promises, including how to create, resolve, and chain them effectively.",
    createdAt: new Date("2023-01-01"),
    lastModifiedAt: null,
    isPublic: true,
    createdBy: "is-no-good",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png"
  },
  {
    title: "Getting Started with Angular",
    description: "An introduction to Angular framework, covering its architecture, components, and how to set up your first project.",
    createdAt: new Date("2023-01-02"),
    lastModifiedAt: new Date("2023-01-03"),
    isPublic: true,
    createdBy: "hercule-poirot",
    imageUrl: "https://angular.io/assets/images/logos/angular/angular.png"
  },
  {
    title: "Top 10 JavaScript ES6 Features You Should Know",
    description: "Explore the most important features introduced in ES6, including arrow functions, destructuring, and template literals.",
    createdAt: new Date("2023-01-04"),
    lastModifiedAt: null,
    isPublic: true,
    createdBy: "hercule-poirot",
    imageUrl: "https://miro.medium.com/1*ktJUMJO60oHoluiEV6KBmA.png"
  },
  {
    title: "Building RESTful APIs with Node.js",
    description: "Learn how to create RESTful APIs using Node.js and Express, including routing, middleware, and error handling.",
    createdAt: new Date("2023-01-05"),
    lastModifiedAt: new Date("2023-01-06"),
    isPublic: false,
    createdBy: "nk-dev",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d9/Node.js_logo.svg"
  },
  {
    title: "The Basics of Docker: A Beginner's Guide",
    description: "A beginner-friendly guide to Docker, explaining containerization, images, and how to deploy applications easily.",
    createdAt: new Date("2023-01-07"),
    lastModifiedAt: null,
    isPublic: false,
    createdBy: "kml-007",
    imageUrl: "https://www.docker.com/wp-content/uploads/2022/03/Moby-logo.png"
  },
  // Additional posts
  {
    title: "An Introduction to TypeScript",
    description: "Learn the basics of TypeScript, its features, and how it improves JavaScript development.",
    createdAt: new Date("2023-01-08"),
    lastModifiedAt: null,
    isPublic: true,
    createdBy: "is-no-good",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg"
  },
  {
    title: "Exploring React Hooks",
    description: "A deep dive into React hooks, including useState and useEffect, and how they simplify state management.",
    createdAt: new Date("2023-01-09"),
    lastModifiedAt: null,
    isPublic: true,
    createdBy: "reactfan",
    imageUrl: "https://reactjs.org/logo-og.png"
  },
  {
    title: "CSS Grid vs Flexbox: Which One to Use?",
    description: "A comparison of CSS Grid and Flexbox, including when to use each layout technique effectively.",
    createdAt: new Date("2023-01-10"),
    lastModifiedAt: null,
    isPublic: true,
    createdBy: "designmaster",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d5/CSS3_logo_and_wordmark.svg"
  },
  {
    title: "Understanding Asynchronous JavaScript",
    description: "A guide to asynchronous JavaScript, including callbacks, promises, and async/await syntax.",
    createdAt: new Date("2023-01-11"),
    lastModifiedAt: null,
    isPublic: true,
    createdBy: "nk-dev",
    imageUrl: "https://www.speqto.com/wp-content/uploads/2025/10/resized_image_1152x769-2.png"
  },
  {
    title: "Web Accessibility: Best Practices",
    description: "Learn the best practices for making your web applications accessible to all users.",
    createdAt: new Date("2023-01-12"),
    lastModifiedAt: null,
    isPublic: true,
    createdBy: "accessibilityguru",
    imageUrl: "https://abilitynet.org.uk/sites/abilitynet.org.uk/files/A11y.jpg"
  },
  {
    title: "DevOps Principles: A Beginner's Guide",
    description: "An introduction to DevOps principles, practices, and tools that improve collaboration between development and operations.",
    createdAt: new Date("2023-01-13"),
    lastModifiedAt: null,
    isPublic: true,
    createdBy: "devopspro",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/05/Devops-toolchain.svg"
  },
  {
    title: "JavaScript Design Patterns",
    description: "Explore common design patterns in JavaScript and how to implement them in your projects.",
    createdAt: new Date("2023-01-14"),
    lastModifiedAt: null,
    isPublic: true,
    createdBy: "designmaster",
    imageUrl: "https://media2.dev.to/dynamic/image/width=1080,height=1080,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2F60z1766j792zk52kpqdv.png"
  },
  {
    title: "Introduction to Machine Learning with Python",
    description: "A beginner's guide to machine learning concepts and how to implement them using Python.",
    createdAt: new Date("2023-01-15"),
    lastModifiedAt: null,
    isPublic: true,
    createdBy: "mlenthusiast",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Python-logo-notext.svg"
  },
  {
    title: "Building Mobile Apps with Flutter",
    description: "Learn how to build cross-platform mobile applications using Flutter and Dart.",
    createdAt: new Date("2023-01-16"),
    lastModifiedAt: null,
    isPublic: true,
    createdBy: "flutterdev",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/17/Google-flutter-logo.png"
  },
  {
    title: "Version Control with Git",
    description: "Understand the fundamentals of version control using Git, including branching and merging.",
    createdAt: new Date("2023-01-17"),
    lastModifiedAt: null,
    isPublic: true,
    createdBy: "gitmaster",
    imageUrl: "https://git-scm.com/images/logos/downloads/Git-Icon-1788C.png"
  },
  {
    title: "Effective Unit Testing in JavaScript",
    description: "A guide to writing effective unit tests in JavaScript using popular testing frameworks.",
    createdAt: new Date("2023-01-18"),
    lastModifiedAt: null,
    isPublic: false,
    createdBy: "nk-dev",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png"
  },
  {
    title: "Introduction to GraphQL",
    description: "Learn the basics of GraphQL, its benefits over REST, and how to set up a GraphQL server.",
    createdAt: new Date("2023-01-19"),
    lastModifiedAt: null,
    isPublic: true,
    createdBy: "graphqlguru",
    imageUrl: "https://graphql.org/img/logo.svg"
  }
];

  fetchPosts():Observable<Post[]>{
    return new Observable(Subscriber =>{
      setTimeout(()=>{
        Subscriber.next(this.MOCK_POSTS)
      }, 500);
    })
  }

  fetchPublicPosts(page: number = 0, limit: number = 5, query: string = ''): Observable<Post[]> {
    return of(this.MOCK_POSTS).pipe(
      delay(500),
      map((posts: Post[]) => {
        const publicPosts = posts.filter(post => post.isPublic);
        const start = page * limit;
        if(!query) return publicPosts.slice(start, start + limit);
        const term = query.toLowerCase().trim();
        return publicPosts.filter((p:Post) => 
          p.title.toLowerCase().includes(term) || 
          p.description.toLowerCase().includes(term)
        ).slice(start, start + limit);
      })
    );
  }

  fetchPostsByUser(userId: string): Observable<Post[]> {
    return of(this.MOCK_POSTS).pipe(
      delay(500),
      map(posts => posts.filter(post => post.createdBy === userId))
    );
  }

  fetchPostByTitle(title: string): Observable<Post> {
    return of(this.MOCK_POSTS.find(post => post.title === title) || {} as Post);
  }

  savePost(post:Post):Observable<Post>{ 
    this.MOCK_POSTS.push(post);
    this.dataChangedTrigger.next();
    return of(post).pipe(delay(800));
  }

  updatePost(title: string, changes: Partial<Post>): Observable<Post> {
    const index = this.MOCK_POSTS.findIndex(p => p.title === title);
    if (index !== -1) {
      // Update the "Server" state
      this.MOCK_POSTS[index] = { ...this.MOCK_POSTS[index], ...changes };
      this.dataChangedTrigger.next();
      return of(this.MOCK_POSTS[index]).pipe(delay(500));
    }
    return throwError(() => "Post not found");
  }

  deletePost(title:string):Observable<void>{
    this.MOCK_POSTS = this.MOCK_POSTS.filter(p => p.title !== title);
    return of();
  }
}