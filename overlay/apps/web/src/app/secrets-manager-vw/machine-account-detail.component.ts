import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { lastValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BreadcrumbsModule,
  ButtonModule,
  DialogService,
  TabsModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { openMachineAccountDialog } from "./machine-account-dialog.component";
import { MachineAccountService } from "./machine-account.service";
import { SmNewMenuComponent } from "./sm-new-menu.component";

/** A machine account's page: a header with breadcrumb + routed tabs (Access tokens / People / Projects). */
@Component({
  selector: "sm-machine-account-detail",
  standalone: true,
  templateUrl: "./machine-account-detail.component.html",
  imports: [
    CommonModule,
    RouterModule,
    HeaderModule,
    BreadcrumbsModule,
    TabsModule,
    ButtonModule,
    SmNewMenuComponent,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineAccountDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly machineAccountService = inject(MachineAccountService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly organizationId = this.route.snapshot.params.organizationId as string;

  /**
   * The back breadcrumb navigates on click rather than by `route`: bit-breadcrumb treats a route
   * that is a path prefix of the current URL as the active page and renders it as plain text.
   */
  protected back(): Promise<boolean> {
    return this.router.navigate(["/sm", this.organizationId, "machine-accounts"]);
  }
  protected readonly machineAccountId = this.route.snapshot.params.machineAccountId as string;
  protected readonly name = signal("");

  constructor() {
    void this.loadName();
  }

  private async loadName(): Promise<void> {
    try {
      const machineAccounts = await this.machineAccountService.list(this.organizationId);
      this.name.set(machineAccounts.find((m) => m.id === this.machineAccountId)?.name ?? "");
    } catch {
      /* the header simply shows no name if the lookup fails */
    }
  }

  protected async edit(): Promise<void> {
    const machineAccount = {
      id: this.machineAccountId,
      name: this.name(),
      creationDate: "",
      revisionDate: "",
    };
    const dialogRef = openMachineAccountDialog(this.dialogService, {
      data: { organizationId: this.organizationId, machineAccount },
    });
    if (await lastValueFrom(dialogRef.closed)) {
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("machineAccountUpdated"),
      });
      await this.loadName();
    }
  }
}
