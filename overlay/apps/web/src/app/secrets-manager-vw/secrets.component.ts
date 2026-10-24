import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { lastValueFrom, map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  BadgeModule,
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

import { openSecretDialog } from "./secret-dialog.component";
import { SecretListView, SecretService } from "./secret.service";
import { SmEventsService } from "./sm-events.service";
import { SmNewMenuComponent } from "./sm-new-menu.component";

/** Secrets list for an organization: sortable table with copy-value, overflow menu, create/edit/delete. */
@Component({
  selector: "sm-secrets",
  standalone: true,
  templateUrl: "./secrets.component.html",
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    HeaderModule,
    SearchModule,
    BadgeModule,
    IconButtonModule,
    LinkModule,
    MenuModule,
    TableModule,
    SmNewMenuComponent,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly secretService = inject(SecretService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly events = inject(SmEventsService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly dataSource = new TableDataSource<SecretListView>();
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

  protected get hasSecrets(): boolean {
    return this.dataSource.data.length > 0;
  }

  protected projectName(secret: SecretListView): string {
    return secret.projects.map((p) => p.name).join(", ");
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.dataSource.data = await this.secretService.list(this.organizationId);
    } catch {
      this.failed.set(true);
      this.dataSource.data = [];
    } finally {
      this.loading.set(false);
    }
  }

  protected async edit(secret: SecretListView): Promise<void> {
    const dialogRef = openSecretDialog(this.dialogService, {
      data: { organizationId: this.organizationId, secret },
    });
    if (await lastValueFrom(dialogRef.closed)) {
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("secretEdited"),
      });
      await this.refresh();
    }
  }

  protected async remove(secret: SecretListView): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteSecret" },
      content: { key: "hardDeleteSecretConfirmation" },
      type: "warning",
      acceptButtonText: { key: "delete" },
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.secretService.delete([secret.id]);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("hardDeleteSuccessToast"),
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

  /** The list omits the value, so fetch the full secret before copying. */
  protected async copyValue(secret: SecretListView): Promise<void> {
    try {
      const full = await this.secretService.get(this.organizationId, secret.id);
      this.platformUtilsService.copyToClipboard(full.value);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("valueCopied", this.i18nService.t("value")),
      });
    } catch {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  }
}
