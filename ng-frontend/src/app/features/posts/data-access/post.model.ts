export interface Post {
  uuid?: string,
  title: string,
  description: string,
  createdAt: Date,
  lastModifiedAt: Date | null
  isPublic: boolean
  createdBy: string,
  imageUrl?: string | null
}
export interface PostState {
  posts: Post[],
  isLoading: boolean,
  error: string | null
}
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean
}