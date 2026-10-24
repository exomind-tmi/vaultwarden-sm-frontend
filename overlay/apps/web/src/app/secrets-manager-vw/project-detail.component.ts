import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { lastValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BreadcrumbsModule,
  ButtonModule,
  DialogService,
  TabsModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { openProjectDialog } from "./project-dialog.component";
import { ProjectService } from "./project.service";
import { SmNewMenuComponent } from "./sm-new-menu.component";

/** A project's page: a header with breadcrumb + routed tabs (Secrets / People / Machine accounts). */
@Component({
  selector: "sm-project-detail",
  standalone: true,
  templateUrl: "./project-detail.component.html",
  imports: [
    CommonModule,
    RouterModule,
    HeaderModule,
    BreadcrumbsModule,
    TabsModule,
    ButtonModule,
    SmNewMenuComponent,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly organizationId = this.route.snapshot.params.organizationId as string;

  /**
   * The back breadcrumb navigates on click rather than by `route`: bit-breadcrumb treats a route
   * that is a path prefix of the current URL as the active page and renders it as plain text.
   */
  protected back(): Promise<boolean> {
    return this.router.navigate(["/sm", this.organizationId, "projects"]);
  }
  protected readonly projectId = this.route.snapshot.params.projectId as string;
  protected readonly name = signal("");

  constructor() {
    void this.loadName();
  }

  private async loadName(): Promise<void> {
    try {
      const projects = await this.projectService.list(this.organizationId);
      this.name.set(projects.find((p) => p.id === this.projectId)?.name ?? "");
    } catch {
      /* the header simply shows no name if the lookup fails */
    }
  }

  protected async edit(): Promise<void> {
    const project = { id: this.projectId, name: this.name(), creationDate: "", revisionDate: "" };
    const dialogRef = openProjectDialog(this.dialogService, {
      data: { organizationId: this.organizationId, project },
    });
    if (await lastValueFrom(dialogRef.closed)) {
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("projectSaved"),
      });
      await this.loadName();
    }
  }
}
