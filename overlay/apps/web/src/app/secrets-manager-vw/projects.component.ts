import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { lastValueFrom, map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { openDeleteDialog } from "./delete-dialog.component";
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
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly projectService = inject(ProjectService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
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
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("projectSaved"),
      });
      await this.refresh();
    }
  }

  protected async remove(project: ProjectView): Promise<void> {
    const ref = openDeleteDialog(this.dialogService, {
      title: this.i18nService.t("deleteProject"),
      name: project.name,
      warning: this.i18nService.t("deleteProjectDialogMessage", project.name),
      confirmPhrase: this.i18nService.t("deleteProjectConfirmMessage", project.name),
    });
    const confirmed = await lastValueFrom(ref.closed);
    if (!confirmed) {
      return;
    }
    try {
      await this.projectService.delete([project.id]);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("deleteProjectToast"),
      });
    } catch {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
    await this.refresh();
  }

  protected copyId(id: string): void {
    this.platformUtilsService.copyToClipboard(id);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("valueCopied", this.i18nService.t("uuid")),
    });
  }
}
