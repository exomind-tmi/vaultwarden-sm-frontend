import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { lastValueFrom, map } from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  DialogService,
  IconButtonModule,
  LinkModule,
  MenuModule,
  SearchModule,
  TableDataSource,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { openProjectDialog } from "./project-dialog.component";
import { ProjectService, ProjectView } from "./project.service";
import { SmEventsService } from "./sm-events.service";
import { SmNewMenuComponent } from "./sm-new-menu.component";

/** Projects list for an organization: a sortable table with copy, overflow menu, create/edit/delete. */
@Component({
  selector: "sm-projects",
  standalone: true,
  templateUrl: "./projects.component.html",
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    HeaderModule,
    SearchModule,
    IconButtonModule,
    LinkModule,
    MenuModule,
    TableModule,
    SmNewMenuComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly projectService = inject(ProjectService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly events = inject(SmEventsService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly dataSource = new TableDataSource<ProjectView>();
  protected organizationId = "";

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
    this.events.changed$.pipe(takeUntilDestroyed()).subscribe(() => void this.refresh());
  }

  protected get hasProjects(): boolean {
    return this.dataSource.data.length > 0;
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.dataSource.data = await this.projectService.list(this.organizationId);
    } catch {
      this.failed.set(true);
      this.dataSource.data = [];
    } finally {
      this.loading.set(false);
    }
  }

  protected async edit(project: ProjectView): Promise<void> {
    const dialogRef = openProjectDialog(this.dialogService, {
      data: { organizationId: this.organizationId, project },
    });
    if (await lastValueFrom(dialogRef.closed)) {
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

  protected copyId(id: string): void {
    this.platformUtilsService.copyToClipboard(id);
    this.toastService.showToast({ variant: "success", message: "Project ID copied." });
  }
}
