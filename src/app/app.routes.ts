import { Routes } from '@angular/router';

import { authGuardGuard } from './core/guards/auth-guard-guard';
import { pendingChangesGuard } from './core/guards/pending-changes-guard';
import { Login } from './features/login/login';
import { profileResolver } from './core/resolvers/profile-resolver';
import { Home } from './features/home/home';
import { HomeResolver } from './core/resolvers/home-resolver';
import { DashboardLayout } from './features/dashboard-layout/dashboard-layout';

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
        path: "login",
        loadComponent: () => import("./features/login/login").then(c => c.Login)
    },
    { path: "", redirectTo: "home", pathMatch: "full" }
];