import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { lastValueFrom, map } from "rxjs";

import { ButtonModule, DialogService, IconButtonModule, ToastService } from "@bitwarden/components";

import { openSecretDialog, SecretDialogResult } from "./secret-dialog.component";
import { SecretListView, SecretService } from "./secret.service";

/** Secrets list for an organization: create, edit, and delete secrets. */
@Component({
  selector: "sm-secrets",
  standalone: true,
  templateUrl: "./secrets.component.html",
  imports: [CommonModule, ButtonModule, IconButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly secretService = inject(SecretService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly secrets = signal<SecretListView[]>([]);

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
      this.secrets.set(await this.secretService.list(this.organizationId));
    } catch {
      this.failed.set(true);
      this.secrets.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected projectNames(secret: SecretListView): string {
    return secret.projects.map((p) => p.name).join(", ");
  }

  protected async add(): Promise<void> {
    const dialogRef = openSecretDialog(this.dialogService, {
      data: { organizationId: this.organizationId },
    });
    if ((await lastValueFrom(dialogRef.closed)) === SecretDialogResult.Saved) {
      this.toastService.showToast({ variant: "success", message: "Secret created." });
      await this.refresh();
    }
  }

  protected async edit(secret: SecretListView): Promise<void> {
    const dialogRef = openSecretDialog(this.dialogService, {
      data: { organizationId: this.organizationId, secret },
    });
    if ((await lastValueFrom(dialogRef.closed)) === SecretDialogResult.Saved) {
      this.toastService.showToast({ variant: "success", message: "Secret saved." });
      await this.refresh();
    }
  }

  protected async remove(secret: SecretListView): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: "Delete secret",
      content: "This secret will be permanently deleted.",
      type: "warning",
      acceptButtonText: "Delete",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.secretService.delete([secret.id]);
      this.toastService.showToast({ variant: "success", message: "Secret deleted." });
    } catch {
      this.toastService.showToast({ variant: "error", message: "Failed to delete secret." });
    }
    await this.refresh();
  }
}
