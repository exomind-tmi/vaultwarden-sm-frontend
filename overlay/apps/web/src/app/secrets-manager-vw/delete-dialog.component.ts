import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
} from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  InputModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** What is being deleted, as the dialog shows it. All strings arrive translated. */
export interface DeleteDialogParams {
  /** "Delete project" — the title and the confirm button. */
  title: string;
  /** The object's name, shown beside the title. */
  name: string;
  /** Why this is final, in the warning callout. */
  warning: string;
  /** The phrase the user must type to enable the deletion, e.g. "Delete Backend". */
  confirmPhrase: string;
}

/**
 * Type-to-confirm deletion, the vanilla Secrets Manager pattern for projects and machine accounts.
 * Closes with `true` once the phrase was typed and confirmed; the caller performs the deletion.
 */
@Component({
  selector: "sm-delete-dialog",
  standalone: true,
  templateUrl: "./delete-dialog.component.html",
  imports: [
    ReactiveFormsModule,
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    FormFieldModule,
    InputModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteDialogComponent {
  protected readonly params = inject<DeleteDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly i18nService = inject(I18nService);

  protected readonly form = new FormGroup({
    confirm: new FormControl("", {
      nonNullable: true,
      validators: (control: AbstractControl): ValidationErrors | null =>
        control.value === this.params.confirmPhrase
          ? null
          : { confirmationRequired: { message: this.i18nService.t("smConfirmationRequired") } },
    }),
  });

  protected readonly submit = async (): Promise<void> => {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(true);
  };
}

export const openDeleteDialog = (dialogService: DialogService, data: DeleteDialogParams) =>
  dialogService.open<boolean, DeleteDialogParams>(DeleteDialogComponent, { data });
