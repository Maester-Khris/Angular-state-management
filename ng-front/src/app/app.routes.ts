import { Routes } from '@angular/router';

import { authGuardGuard } from './core/guards/auth-guard-guard';
import { pendingChangesGuard } from './core/guards/pending-changes-guard';
import { profileResolver } from './core/resolvers/profile-resolver';
import { HomeResolver } from './core/resolvers/home-resolver';
import { DashboardLayout } from './features/dashboard-layout/dashboard-layout';
import { AuthShell } from './features/auth/auth-shell/auth-shell';

export const routes: Routes = [
    {
        path: "home",
        loadComponent: () => import("./features/home/home").then(c => c.Home),
        resolve: { initialPosts: HomeResolver },
        children: [
            {
                path: "view/:title",
                loadComponent: () => import("./features/post-detail/post-detail").then(c => c.PostDetail)
            }
        ]
    },
    {
        path: 'dashboard',
        component: DashboardLayout,
        children: [
            {
                path: "myactivity",
                loadComponent: () => import("./features/posts/posts").then(c => c.Posts),
                canActivate: [authGuardGuard],
                canDeactivate: [pendingChangesGuard]
            },
            {
                path: "profile",
                loadComponent: () => import("./features/profile/profile").then(c => c.Profile),
                canActivate: [authGuardGuard],
                resolve: { profileData: profileResolver }
            },
            { path: '', redirectTo: 'myactivity', pathMatch: 'full' }
        ]
    },
    {
        path: 'auth',
        component: AuthShell,
        children: [
            { path: '', redirectTo: 'login', pathMatch: 'full' } // We keep the shell but can use redirect to handle /login vs /signup
        ]
    },
    // High-end trick: Map direct URLs to the same Shell
    { path: 'login', component: AuthShell },
    { path: 'signup', component: AuthShell },
    { path: "", redirectTo: "home", pathMatch: "full" }
]; 
