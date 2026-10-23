import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { lastValueFrom, map } from "rxjs";

import { ButtonModule, DialogService, IconButtonModule, ToastService } from "@bitwarden/components";

import { openProjectDialog, ProjectDialogResult } from "./project-dialog.component";
import { ProjectService, ProjectView } from "./project.service";

/** Projects list for an organization: create, rename, and delete projects. */
@Component({
  selector: "sm-projects",
  standalone: true,
  templateUrl: "./projects.component.html",
  imports: [CommonModule, ButtonModule, IconButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly projectService = inject(ProjectService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly projects = signal<ProjectView[]>([]);

  private organizationId = "";

  constructor() {
    this.route.params
      .pipe(
        map((p) => p.organizationId as string),
        takeUntilDestroyed(),
      )
      .subscribe((id) => {
        this.organizationId = id;
        void this.refresh();
      });
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.projects.set(await this.projectService.list(this.organizationId));
    } catch {
      this.failed.set(true);
      this.projects.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected async add(): Promise<void> {
    const dialogRef = openProjectDialog(this.dialogService, {
      data: { organizationId: this.organizationId },
    });
    if ((await lastValueFrom(dialogRef.closed)) === ProjectDialogResult.Saved) {
      this.toastService.showToast({ variant: "success", message: "Project created." });
      await this.refresh();
    }
  }

  protected async edit(project: ProjectView): Promise<void> {
    const dialogRef = openProjectDialog(this.dialogService, {
      data: { organizationId: this.organizationId, project },
    });
    if ((await lastValueFrom(dialogRef.closed)) === ProjectDialogResult.Saved) {
      this.toastService.showToast({ variant: "success", message: "Project saved." });
      await this.refresh();
    }
  }

  protected async remove(project: ProjectView): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: "Delete project",
      content: "This project and its access policies will be permanently deleted.",
      type: "warning",
      acceptButtonText: "Delete",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.projectService.delete([project.id]);
      this.toastService.showToast({ variant: "success", message: "Project deleted." });
    } catch {
      this.toastService.showToast({ variant: "error", message: "Failed to delete project." });
    }
    await this.refresh();
  }
}
