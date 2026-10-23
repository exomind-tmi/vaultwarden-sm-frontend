import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { lastValueFrom } from "rxjs";

import { ButtonModule, DialogService, MenuModule, ToastService } from "@bitwarden/components";

import { openMachineAccountDialog } from "./machine-account-dialog.component";
import { openProjectDialog } from "./project-dialog.component";
import { openSecretDialog } from "./secret-dialog.component";
import { SmEventsService } from "./sm-events.service";
import { routeParams } from "./sm-route-params";

/**
 * The unified "New" menu in the Secrets Manager header. Its items are the same on every page of the
 * section (Project / Secret / Machine account); each opens the matching create dialog and then takes
 * the user to what was created: its detail page, or — for a secret, which has none — the secrets list.
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
  private readonly router = inject(Router);
  private readonly events = inject(SmEventsService);
  private readonly organizationId = routeParams(inject(ActivatedRoute)).organizationId;

  protected async newProject(): Promise<void> {
    const ref = openProjectDialog(this.dialogService, {
      data: { organizationId: this.organizationId },
    });
    await this.created(await lastValueFrom(ref.closed), "Project created.", (id) => ["projects", id]);
  }

  protected async newSecret(): Promise<void> {
    const ref = openSecretDialog(this.dialogService, {
      data: { organizationId: this.organizationId },
    });
    await this.created(await lastValueFrom(ref.closed), "Secret created.", () => ["secrets"]);
  }

  protected async newMachineAccount(): Promise<void> {
    const ref = openMachineAccountDialog(this.dialogService, {
      data: { organizationId: this.organizationId },
    });
    await this.created(await lastValueFrom(ref.closed), "Machine account created.", (id) => [
      "machine-accounts",
      id,
    ]);
  }

  /** After a create dialog closes: confirm, go to the new object, and refresh lists already shown. */
  private async created(
    id: string | undefined,
    message: string,
    target: (id: string) => string[],
  ): Promise<void> {
    if (!id) {
      return;
    }
    this.toastService.showToast({ variant: "success", message });
    await this.router.navigate(["/sm", this.organizationId, ...target(id)]);
    // Navigating to the page already open (a secret created on the secrets list) does not reload it.
    this.events.notify();
  }
}
