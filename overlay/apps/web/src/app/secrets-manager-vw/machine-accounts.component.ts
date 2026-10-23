import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { lastValueFrom, map } from "rxjs";

import { ButtonModule, DialogService, IconButtonModule, ToastService } from "@bitwarden/components";

import { openAccessTokensDialog } from "./access-tokens-dialog.component";
import {
  MachineAccountDialogResult,
  openMachineAccountDialog,
} from "./machine-account-dialog.component";
import { MachineAccountService, MachineAccountView } from "./machine-account.service";

/** Machine accounts list for an organization: create, rename, delete, and manage access tokens. */
@Component({
  selector: "sm-machine-accounts",
  standalone: true,
  templateUrl: "./machine-accounts.component.html",
  imports: [CommonModule, ButtonModule, IconButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineAccountsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly machineAccountService = inject(MachineAccountService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly machineAccounts = signal<MachineAccountView[]>([]);

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
      this.machineAccounts.set(await this.machineAccountService.list(this.organizationId));
    } catch {
      this.failed.set(true);
      this.machineAccounts.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected async add(): Promise<void> {
    const dialogRef = openMachineAccountDialog(this.dialogService, {
      data: { organizationId: this.organizationId },
    });
    if ((await lastValueFrom(dialogRef.closed)) === MachineAccountDialogResult.Saved) {
      this.toastService.showToast({ variant: "success", message: "Machine account created." });
      await this.refresh();
    }
  }

  protected async edit(machineAccount: MachineAccountView): Promise<void> {
    const dialogRef = openMachineAccountDialog(this.dialogService, {
      data: { organizationId: this.organizationId, machineAccount },
    });
    if ((await lastValueFrom(dialogRef.closed)) === MachineAccountDialogResult.Saved) {
      this.toastService.showToast({ variant: "success", message: "Machine account saved." });
      await this.refresh();
    }
  }

  protected tokens(machineAccount: MachineAccountView): void {
    openAccessTokensDialog(this.dialogService, {
      data: {
        organizationId: this.organizationId,
        machineAccountId: machineAccount.id,
        machineAccountName: machineAccount.name,
      },
    });
  }

  protected async remove(machineAccount: MachineAccountView): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: "Delete machine account",
      content: "This machine account and its access tokens will be permanently deleted.",
      type: "warning",
      acceptButtonText: "Delete",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.machineAccountService.delete([machineAccount.id]);
      this.toastService.showToast({ variant: "success", message: "Machine account deleted." });
    } catch {
      this.toastService.showToast({ variant: "error", message: "Failed to delete machine account." });
    }
    await this.refresh();
  }
}
