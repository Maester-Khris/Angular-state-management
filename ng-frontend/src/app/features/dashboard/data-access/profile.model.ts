export interface UserProfile{
  id: string,
  name: string,
  bio: string,
  avatar: string|null,
  stats: { posts: number; reach: string; coauth: number; since: number };
  savedInsights: any[];
  recentActivity: any[];
}

  // Add these types/interfaces if not already present
// export interface UserProfile {
//   id: string;
//   name: string;
//   bio: string;
//   stats: { posts: number; reach: string; coAuth: number; since: number };
//   savedInsights: any[];
//   recentActivity: any[];
// }