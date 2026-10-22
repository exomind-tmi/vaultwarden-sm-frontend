import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormControl, ReactiveFormsModule, Validators } from "@angular/forms";

import {
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  InputModule,
} from "@bitwarden/components";

import { ProjectService, ProjectView } from "./project.service";

export const ProjectDialogResult = {
  Saved: "saved",
  Cancelled: "cancelled",
} as const;
export type ProjectDialogResult = (typeof ProjectDialogResult)[keyof typeof ProjectDialogResult];

export interface ProjectDialogParams {
  organizationId: string;
  project?: ProjectView;
}

/** Create/edit dialog for a single project. Encryption happens in [`ProjectService`]. */
@Component({
  selector: "sm-project-dialog",
  standalone: true,
  templateUrl: "./project-dialog.component.html",
  imports: [CommonModule, ReactiveFormsModule, DialogModule, ButtonModule, FormFieldModule, InputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDialogComponent {
  private readonly params = inject<ProjectDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<ProjectDialogResult>>(DialogRef);
  private readonly projectService = inject(ProjectService);

  protected readonly editing = this.params.project != null;
  protected readonly title = this.editing ? "Edit project" : "New project";
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);
  protected readonly name = new FormControl(this.params.project?.name ?? "", {
    nonNullable: true,
    validators: [Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.name.invalid) {
      this.name.markAsTouched();
      return;
    }
    this.saving.set(true);
    this.failed.set(false);
    try {
      const value = this.name.value.trim();
      if (this.params.project) {
        await this.projectService.update(this.params.organizationId, this.params.project.id, value);
      } else {
        await this.projectService.create(this.params.organizationId, value);
      }
      this.dialogRef.close(ProjectDialogResult.Saved);
    } catch {
      this.failed.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}

export const openProjectDialog = (
  dialogService: DialogService,
  config: DialogConfig<ProjectDialogParams>,
) => dialogService.open<ProjectDialogResult, ProjectDialogParams>(ProjectDialogComponent, config);
