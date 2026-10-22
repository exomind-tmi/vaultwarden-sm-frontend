import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { lastValueFrom, map } from "rxjs";

import { ButtonModule, DialogService, IconButtonModule } from "@bitwarden/components";

import { openProjectDialog, ProjectDialogResult } from "./project-dialog.component";
import { ProjectService, ProjectView } from "./project.service";

/**
 * The Secrets Manager Projects page, mounted at `/sm/:organizationId`. Lists an organization's
 * projects (names decrypted client-side), and creates/edits/deletes them through dialogs.
 */
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

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
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
    this.error.set(null);
    try {
      this.projects.set(await this.projectService.list(this.organizationId));
    } catch {
      this.error.set("Failed to load projects.");
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
      await this.refresh();
    }
  }

  protected async edit(project: ProjectView): Promise<void> {
    const dialogRef = openProjectDialog(this.dialogService, {
      data: { organizationId: this.organizationId, project },
    });
    if ((await lastValueFrom(dialogRef.closed)) === ProjectDialogResult.Saved) {
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
    await this.projectService.delete([project.id]);
    await this.refresh();
  }
}
