import { Routes } from '@angular/router';

import { authGuardGuard } from './core/guards/auth-guard-guard';
import { pendingChangesGuard } from './core/guards/pending-changes-guard';
import { profileResolver } from './core/resolvers/profile-resolver';
import { HomeResolver } from './core/resolvers/home-resolver';
import { DashboardShell } from './features/dashboard/shell/shell';
import { AuthShell } from './features/auth/auth-shell/auth-shell';

export const routes: Routes = [
    {
        path: "home",
        loadComponent: () => import("./features/home/home").then(c => c.Home),
        resolve: { initialPosts: HomeResolver },
        children: [
            {
                path: "view/:uuid",
                loadComponent: () => import("./features/post-detail/post-detail").then(c => c.PostDetail)
            },
            {
                path: "quick-view/:uuid",
                loadComponent: () =>
                    import("./features/quick-view/quick-view-container.component")
                        .then(c => c.QuickViewContainerComponent)
            }
        ]
    },
    {
        path: 'dashboard',
        component: DashboardShell,
        children: [
            {
                path: "myactivity",
                loadComponent: () => import("./features/dashboard/writer-console/writer-console").then(c => c.WriterConsole),
                canActivate: [authGuardGuard],
                canDeactivate: [pendingChangesGuard]
            },
            {
                path: "profile",
                canActivate: [authGuardGuard],
                resolve: { profileData: profileResolver },
                children: [
                    {
                        path: '',
                        loadComponent: () => import("./features/dashboard/writer-profile/writer-profile").then(c => c.WriterProfile),
                    },
                    {
                        path: 'edit',
                        loadComponent: () => import("./features/dashboard/writer-profile/profile-edit/profile-edit").then(c => c.ProfileEdit),
                    },
                    {
                        path: 'saved',
                        loadComponent: () => import("./features/dashboard/writer-profile/profile-saved/profile-saved").then(c => c.ProfileSaved),
                    }
                ]
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
