import { Routes } from "@angular/router";

import { LayoutComponent } from "./layout.component";
import { NavigationComponent } from "./navigation.component";

/**
 * Routes for the Secrets Manager, mounted at `/sm/:organizationId` as its own top-level layout so
 * the Password Manager navigation is replaced rather than inherited.
 */
export const smRoutes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      { path: "", component: NavigationComponent, outlet: "sidebar" },
      { path: "", pathMatch: "full", redirectTo: "projects" },
      {
        path: "projects",
        loadComponent: () => import("./projects.component").then((m) => m.ProjectsComponent),
      },
      {
        path: "projects/:projectId",
        loadComponent: () =>
          import("./project-detail.component").then((m) => m.ProjectDetailComponent),
      },
      {
        path: "secrets",
        loadComponent: () => import("./secrets.component").then((m) => m.SecretsComponent),
      },
      {
        path: "machine-accounts",
        loadComponent: () =>
          import("./machine-accounts.component").then((m) => m.MachineAccountsComponent),
      },
      {
        path: "machine-accounts/:machineAccountId",
        loadComponent: () =>
          import("./machine-account-detail.component").then((m) => m.MachineAccountDetailComponent),
      },
    ],
  },
];
