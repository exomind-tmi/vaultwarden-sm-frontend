import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { lastValueFrom } from "rxjs";

import { BreadcrumbsModule, ButtonModule, DialogService, TabsModule, ToastService } from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { openProjectDialog, ProjectDialogResult } from "./project-dialog.component";
import { ProjectService } from "./project.service";

/** A project's page: a header with breadcrumb + routed tabs (Secrets / People / Machine accounts). */
@Component({
  selector: "sm-project-detail",
  standalone: true,
  templateUrl: "./project-detail.component.html",
  imports: [CommonModule, RouterModule, HeaderModule, BreadcrumbsModule, TabsModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly projectService = inject(ProjectService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);

  protected readonly organizationId = this.route.snapshot.params.organizationId as string;
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
    if ((await lastValueFrom(dialogRef.closed)) === ProjectDialogResult.Saved) {
      this.toastService.showToast({ variant: "success", message: "Project saved." });
      await this.loadName();
    }
  }
}
