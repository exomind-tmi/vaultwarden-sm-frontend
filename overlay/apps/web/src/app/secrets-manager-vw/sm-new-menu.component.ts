import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { lastValueFrom } from "rxjs";

import { ButtonModule, DialogService, MenuModule, ToastService } from "@bitwarden/components";

import {
  MachineAccountDialogResult,
  openMachineAccountDialog,
} from "./machine-account-dialog.component";
import { openProjectDialog, ProjectDialogResult } from "./project-dialog.component";
import { openSecretDialog, SecretDialogResult } from "./secret-dialog.component";
import { SmEventsService } from "./sm-events.service";
import { routeParams } from "./sm-route-params";

/**
 * The unified "New" menu in the Secrets Manager header. Its items are the same on every page of the
 * section (Project / Secret / Machine account); each opens the matching create dialog and announces
 * the change so the current list reloads.
 */
@Component({
  selector: "sm-new-menu",
  standalone: true,
  templateUrl: "./sm-new-menu.component.html",
  imports: [ButtonModule, MenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmNewMenuComponent {
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly events = inject(SmEventsService);
  private readonly organizationId = routeParams(inject(ActivatedRoute)).organizationId;

  protected async newProject(): Promise<void> {
    const ref = openProjectDialog(this.dialogService, {
      data: { organizationId: this.organizationId },
    });
    if ((await lastValueFrom(ref.closed)) === ProjectDialogResult.Saved) {
      this.toastService.showToast({ variant: "success", message: "Project created." });
      this.events.notify();
    }
  }

  protected async newSecret(): Promise<void> {
    const ref = openSecretDialog(this.dialogService, {
      data: { organizationId: this.organizationId },
    });
    if ((await lastValueFrom(ref.closed)) === SecretDialogResult.Saved) {
      this.toastService.showToast({ variant: "success", message: "Secret created." });
      this.events.notify();
    }
  }

  protected async newMachineAccount(): Promise<void> {
    const ref = openMachineAccountDialog(this.dialogService, {
      data: { organizationId: this.organizationId },
    });
    if ((await lastValueFrom(ref.closed)) === MachineAccountDialogResult.Saved) {
      this.toastService.showToast({ variant: "success", message: "Machine account created." });
      this.events.notify();
    }
  }
}
