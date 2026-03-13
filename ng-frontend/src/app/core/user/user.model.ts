
export interface AuthUser {
  id: string,
  email: string
}
export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  idToken: string;
}
export interface AppUser {
  uuid: string;
  name: string;
  email: string;
  avatarUrl: string;
  bio?: string;
  status: 'active' | 'away' | 'offline';
  isVerified: boolean;
  source: 'google' | 'internal'; // Track origin for UI logic if needed
}