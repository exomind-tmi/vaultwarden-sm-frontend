import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

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
import { I18nPipe } from "@bitwarden/ui-common";

import { ProjectService, ProjectView } from "./project.service";
import { SecretInput, SecretListView, SecretService } from "./secret.service";

export interface SecretDialogParams {
  organizationId: string;
  secret?: SecretListView;
}

/** Create/edit dialog for a secret. The value and note are fetched for editing and encrypted on save. */
@Component({
  selector: "sm-secret-dialog",
  standalone: true,
  templateUrl: "./secret-dialog.component.html",
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    FormFieldModule,
    InputModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretDialogComponent {
  private readonly params = inject<SecretDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<string>>(DialogRef);
  private readonly secretService = inject(SecretService);
  private readonly projectService = inject(ProjectService);

  protected readonly editing = this.params.secret != null;
  protected readonly titleKey = this.editing ? "editSecret" : "newSecret";
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);
  protected readonly projects = signal<ProjectView[]>([]);

  protected readonly form = new FormGroup({
    key: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    value: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    note: new FormControl("", { nonNullable: true }),
    projectId: new FormControl("", { nonNullable: true }),
  });

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      this.projects.set(await this.projectService.list(this.params.organizationId));
    } catch {
      /* the project select is simply empty if projects cannot be loaded */
    }
    if (this.params.secret) {
      try {
        const full = await this.secretService.get(
          this.params.organizationId,
          this.params.secret.id,
        );
        this.form.patchValue({
          key: full.key,
          value: full.value,
          note: full.note,
          projectId: full.projects[0]?.id ?? "",
        });
      } catch {
        this.failed.set(true);
      }
    }
    this.loading.set(false);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.failed.set(false);
    const v = this.form.getRawValue();
    const input: SecretInput = {
      key: v.key.trim(),
      value: v.value,
      note: v.note,
      projectIds: v.projectId ? [v.projectId] : [],
    };
    try {
      let id: string;
      if (this.params.secret) {
        id = this.params.secret.id;
        await this.secretService.update(this.params.organizationId, id, input);
      } else {
        id = await this.secretService.create(this.params.organizationId, input);
      }
      this.dialogRef.close(id);
    } catch {
      this.failed.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}

export const openSecretDialog = (
  dialogService: DialogService,
  config: DialogConfig<SecretDialogParams>,
) => dialogService.open<string, SecretDialogParams>(SecretDialogComponent, config);
