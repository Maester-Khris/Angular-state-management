import { Routes } from '@angular/router';

import { authGuardGuard } from './core/guards/auth-guard-guard';
import { pendingChangesGuard } from './core/guards/pending-changes-guard';
import { Login } from './features/login/login';
import { profileResolver } from './core/resolvers/profile-resolver';
import { Home } from './features/home/home';

export const routes: Routes = [
    {path:"home", component:Home},
    {
        path: "posts",
        loadComponent: () => import("./features/posts/poststore").then(c => c.Poststore),
        canDeactivate: [pendingChangesGuard]
    },
    {
        path:"profile",
        loadComponent: () => import("./features/profile/profile").then(c => c.Profile),
        canActivate: [authGuardGuard],
        resolve: {
            profileData: profileResolver
        }
    },
    {path:"login", component: Login},
    {path:"", redirectTo: "home", pathMatch:"full"}
];
