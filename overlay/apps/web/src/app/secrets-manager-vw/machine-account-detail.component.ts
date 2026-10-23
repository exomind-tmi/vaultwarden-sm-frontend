import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { lastValueFrom } from "rxjs";

import { BreadcrumbsModule, ButtonModule, DialogService, TabsModule, ToastService } from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import {
  openMachineAccountDialog,
} from "./machine-account-dialog.component";
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineAccountDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly machineAccountService = inject(MachineAccountService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);

  protected readonly organizationId = this.route.snapshot.params.organizationId as string;
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
      this.toastService.showToast({ variant: "success", message: "Machine account saved." });
      await this.loadName();
    }
  }
}
