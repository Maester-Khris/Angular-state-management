export interface Post {
  uuid?: string,
  title: string,
  description: string,
  createdAt: Date,
  lastModifiedAt: Date | null
  isPublic: boolean
  createdBy: string,
  imageUrl?: string | null
  // backend fields
  authorName?: string,
  authorAvatar?: string,
  images?: string[],
  hashtags?: string[],
  isDraft?: boolean,
  lastEditedAt?: string,
  views?: number,
  // new post model fields
  slug?: string,
  publishedAt?: string | Date,
  readTime?: number,
}
export interface PostState {
  posts: Post[],
  isLoading: boolean,
  error: string | null
}
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean
}