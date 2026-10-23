import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { lastValueFrom } from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  DialogService,
  IconButtonModule,
  MenuModule,
  TableDataSource,
  TableModule,
  ToastService,
} from "@bitwarden/components";

import { openSecretDialog, SecretDialogResult } from "./secret-dialog.component";
import { SecretListView, SecretService } from "./secret.service";
import { routeParams } from "./sm-route-params";

/** The Secrets tab of a project: the secrets assigned to it. */
@Component({
  selector: "sm-project-secrets",
  standalone: true,
  templateUrl: "./project-secrets.component.html",
  imports: [CommonModule, ButtonModule, IconButtonModule, MenuModule, TableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectSecretsComponent {
  private readonly secretService = inject(SecretService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly params = routeParams(inject(ActivatedRoute));

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly dataSource = new TableDataSource<SecretListView>();

  constructor() {
    void this.refresh();
  }

  protected get hasSecrets(): boolean {
    return this.dataSource.data.length > 0;
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const all = await this.secretService.list(this.params.organizationId);
      this.dataSource.data = all.filter((s) => s.projects.some((p) => p.id === this.params.projectId));
    } catch {
      this.failed.set(true);
      this.dataSource.data = [];
    } finally {
      this.loading.set(false);
    }
  }

  protected async edit(secret: SecretListView): Promise<void> {
    const dialogRef = openSecretDialog(this.dialogService, {
      data: { organizationId: this.params.organizationId, secret },
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

  protected copyId(id: string): void {
    this.platformUtilsService.copyToClipboard(id);
    this.toastService.showToast({ variant: "success", message: "Secret ID copied." });
  }

  protected async copyValue(secret: SecretListView): Promise<void> {
    try {
      const full = await this.secretService.get(this.params.organizationId, secret.id);
      this.platformUtilsService.copyToClipboard(full.value);
      this.toastService.showToast({ variant: "success", message: "Secret value copied." });
    } catch {
      this.toastService.showToast({ variant: "error", message: "Failed to copy secret value." });
    }
  }
}
