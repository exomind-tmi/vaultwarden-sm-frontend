import { Routes } from "@angular/router";

import { SmLayoutComponent } from "./sm-layout.component";

/** Routes for the Secrets Manager, mounted under `/sm/:organizationId`. */
export const smRoutes: Routes = [
  {
    path: "",
    component: SmLayoutComponent,
    children: [
      { path: "", pathMatch: "full", redirectTo: "projects" },
      {
        path: "projects",
        loadComponent: () => import("./projects.component").then((m) => m.ProjectsComponent),
      },
    ],
  },
];
