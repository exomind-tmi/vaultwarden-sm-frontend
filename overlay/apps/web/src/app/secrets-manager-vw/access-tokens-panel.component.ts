import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, Input, OnInit, signal } from "@angular/core";
import { FormControl, ReactiveFormsModule, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, IconButtonModule, InputModule, ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessTokenView, MachineAccountService } from "./machine-account.service";

/**
 * Access-tokens tab for a machine account: lists tokens, issues new ones (the full token is shown
 * once, right after creation, since the backend never stores it) and revokes them.
 */
@Component({
  selector: "sm-access-tokens-panel",
  standalone: true,
  templateUrl: "./access-tokens-panel.component.html",
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    IconButtonModule,
    InputModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessTokensPanelComponent implements OnInit {
  @Input({ required: true }) organizationId!: string;
  @Input({ required: true }) machineAccountId!: string;

  private readonly machineAccountService = inject(MachineAccountService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly creating = signal(false);
  protected readonly tokens = signal<AccessTokenView[]>([]);
  /** The full token string, held only until dismissed so it can be copied once. */
  protected readonly newToken = signal<string | null>(null);

  protected readonly name = new FormControl("", {
    nonNullable: true,
    validators: [Validators.required],
  });

  ngOnInit(): void {
    void this.refresh();
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.tokens.set(
        await this.machineAccountService.listTokens(this.organizationId, this.machineAccountId),
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
        this.organizationId,
        this.machineAccountId,
        this.name.value.trim(),
      );
      this.newToken.set(token);
      this.name.reset("");
      await this.refresh();
    } catch {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
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
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("valueCopied", this.i18nService.t("accessToken")),
    });
  }

  protected dismissNewToken(): void {
    this.newToken.set(null);
  }

  protected async revoke(token: AccessTokenView): Promise<void> {
    try {
      await this.machineAccountService.revokeToken(this.machineAccountId, token.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("accessTokenRevoked"),
      });
    } catch {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
    await this.refresh();
  }
}
