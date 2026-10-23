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
      // Secrets is the default landing — this is a Secrets Manager, and we have no Overview page.
      { path: "", pathMatch: "full", redirectTo: "secrets" },
      {
        path: "projects",
        loadComponent: () => import("./projects.component").then((m) => m.ProjectsComponent),
      },
      {
        path: "projects/:projectId",
        loadComponent: () =>
          import("./project-detail.component").then((m) => m.ProjectDetailComponent),
        children: [
          { path: "", pathMatch: "full", redirectTo: "secrets" },
          {
            path: "secrets",
            loadComponent: () =>
              import("./project-secrets.component").then((m) => m.ProjectSecretsComponent),
          },
          {
            path: "people",
            loadComponent: () =>
              import("./project-people.component").then((m) => m.ProjectPeopleComponent),
          },
          {
            path: "machine-accounts",
            loadComponent: () =>
              import("./project-machine-accounts.component").then(
                (m) => m.ProjectMachineAccountsComponent,
              ),
          },
        ],
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
        children: [
          { path: "", pathMatch: "full", redirectTo: "access-tokens" },
          {
            path: "access-tokens",
            loadComponent: () =>
              import("./machine-account-tokens.component").then(
                (m) => m.MachineAccountTokensComponent,
              ),
          },
          {
            path: "people",
            loadComponent: () =>
              import("./machine-account-people.component").then(
                (m) => m.MachineAccountPeopleComponent,
              ),
          },
          {
            path: "projects",
            loadComponent: () =>
              import("./machine-account-projects.component").then(
                (m) => m.MachineAccountProjectsComponent,
              ),
          },
        ],
      },
    ],
  },
];
