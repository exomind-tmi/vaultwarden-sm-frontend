import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { lastValueFrom, map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
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

import { openMachineAccountDialog } from "./machine-account-dialog.component";
import { MachineAccountService, MachineAccountView } from "./machine-account.service";
import { SmEventsService } from "./sm-events.service";
import { SmNewMenuComponent } from "./sm-new-menu.component";

/** Machine accounts list: sortable table with copy, overflow menu, create/edit/delete. */
@Component({
  selector: "sm-machine-accounts",
  standalone: true,
  templateUrl: "./machine-accounts.component.html",
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    HeaderModule,
    SearchModule,
    IconButtonModule,
    LinkModule,
    MenuModule,
    TableModule,
    SmNewMenuComponent,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineAccountsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly machineAccountService = inject(MachineAccountService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly events = inject(SmEventsService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly dataSource = new TableDataSource<MachineAccountView>();
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

  protected get hasMachineAccounts(): boolean {
    return this.dataSource.data.length > 0;
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.dataSource.data = await this.machineAccountService.list(this.organizationId);
    } catch {
      this.failed.set(true);
      this.dataSource.data = [];
    } finally {
      this.loading.set(false);
    }
  }

  protected async edit(machineAccount: MachineAccountView): Promise<void> {
    const dialogRef = openMachineAccountDialog(this.dialogService, {
      data: { organizationId: this.organizationId, machineAccount },
    });
    if (await lastValueFrom(dialogRef.closed)) {
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("machineAccountUpdated"),
      });
      await this.refresh();
    }
  }

  protected async remove(machineAccount: MachineAccountView): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteMachineAccount" },
      content: { key: "deleteMachineAccountDialogMessage", placeholders: [machineAccount.name] },
      type: "warning",
      acceptButtonText: { key: "delete" },
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.machineAccountService.delete([machineAccount.id]);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("deleteMachineAccountToast"),
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
}
