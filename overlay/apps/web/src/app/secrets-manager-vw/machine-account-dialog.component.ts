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

import { MachineAccountService, MachineAccountView } from "./machine-account.service";

export interface MachineAccountDialogParams {
  organizationId: string;
  machineAccount?: MachineAccountView;
}

/** Create/edit dialog for a machine account. Encryption happens in [`MachineAccountService`]. */
@Component({
  selector: "sm-machine-account-dialog",
  standalone: true,
  templateUrl: "./machine-account-dialog.component.html",
  imports: [CommonModule, ReactiveFormsModule, DialogModule, ButtonModule, FormFieldModule, InputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineAccountDialogComponent {
  private readonly params = inject<MachineAccountDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<string>>(DialogRef);
  private readonly machineAccountService = inject(MachineAccountService);

  protected readonly editing = this.params.machineAccount != null;
  protected readonly title = this.editing ? "Edit machine account" : "New machine account";
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);
  protected readonly name = new FormControl(this.params.machineAccount?.name ?? "", {
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
      let id: string;
      if (this.params.machineAccount) {
        id = this.params.machineAccount.id;
        await this.machineAccountService.update(this.params.organizationId, id, value);
      } else {
        id = await this.machineAccountService.create(this.params.organizationId, value);
      }
      this.dialogRef.close(id);
    } catch {
      this.failed.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}

export const openMachineAccountDialog = (
  dialogService: DialogService,
  config: DialogConfig<MachineAccountDialogParams>,
) =>
  dialogService.open<string, MachineAccountDialogParams>(
    MachineAccountDialogComponent,
    config,
  );
