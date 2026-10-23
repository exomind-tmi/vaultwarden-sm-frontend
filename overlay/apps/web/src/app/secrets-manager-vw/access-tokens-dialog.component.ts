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
  IconButtonModule,
  InputModule,
  ToastService,
} from "@bitwarden/components";

import { AccessTokenView, MachineAccountService } from "./machine-account.service";

export interface AccessTokensDialogParams {
  organizationId: string;
  machineAccountId: string;
  machineAccountName: string;
}

/**
 * Manages a machine account's access tokens: lists them, issues new ones (the full token is shown
 * exactly once, right after creation, since the backend never stores it) and revokes them.
 */
@Component({
  selector: "sm-access-tokens-dialog",
  standalone: true,
  templateUrl: "./access-tokens-dialog.component.html",
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    IconButtonModule,
    FormFieldModule,
    InputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessTokensDialogComponent {
  private readonly params = inject<AccessTokensDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef);
  private readonly machineAccountService = inject(MachineAccountService);
  private readonly toastService = inject(ToastService);

  protected readonly machineAccountName = this.params.machineAccountName;
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly creating = signal(false);
  protected readonly tokens = signal<AccessTokenView[]>([]);
  /** The full token string, held only until the dialog closes so it can be copied once. */
  protected readonly newToken = signal<string | null>(null);

  protected readonly name = new FormControl("", {
    nonNullable: true,
    validators: [Validators.required],
  });

  constructor() {
    void this.refresh();
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.tokens.set(
        await this.machineAccountService.listTokens(
          this.params.organizationId,
          this.params.machineAccountId,
        ),
      );
    } catch {
      this.failed.set(true);
      this.tokens.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected async create(): Promise<void> {
    if (this.name.invalid) {
      this.name.markAsTouched();
      return;
    }
    this.creating.set(true);
    try {
      const token = await this.machineAccountService.createToken(
        this.params.organizationId,
        this.params.machineAccountId,
        this.name.value.trim(),
      );
      this.newToken.set(token);
      this.name.reset("");
      await this.refresh();
    } catch {
      this.toastService.showToast({ variant: "error", message: "Failed to create access token." });
    } finally {
      this.creating.set(false);
    }
  }

  protected async copy(): Promise<void> {
    const token = this.newToken();
    if (token == null) {
      return;
    }
    await navigator.clipboard.writeText(token);
    this.toastService.showToast({ variant: "success", message: "Access token copied." });
  }

  protected dismissNewToken(): void {
    this.newToken.set(null);
  }

  protected async revoke(token: AccessTokenView): Promise<void> {
    try {
      await this.machineAccountService.revokeToken(this.params.machineAccountId, token.id);
      this.toastService.showToast({ variant: "success", message: "Access token revoked." });
    } catch {
      this.toastService.showToast({ variant: "error", message: "Failed to revoke access token." });
    }
    await this.refresh();
  }

  protected close(): void {
    this.dialogRef.close();
  }
}

export const openAccessTokensDialog = (
  dialogService: DialogService,
  config: DialogConfig<AccessTokensDialogParams>,
) => dialogService.open(AccessTokensDialogComponent, config);
