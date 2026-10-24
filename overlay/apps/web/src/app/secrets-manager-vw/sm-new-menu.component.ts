import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { lastValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, DialogService, MenuModule, ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { openMachineAccountDialog } from "./machine-account-dialog.component";
import { openProjectDialog } from "./project-dialog.component";
import { openSecretDialog } from "./secret-dialog.component";
import { SmEventsService } from "./sm-events.service";
import { routeParams } from "./sm-route-params";

/**
 * The unified "New" menu in the Secrets Manager header. Its items are the same on every page of the
 * section (Project / Secret / Machine account); each opens the matching create dialog and then takes
 * the user to what was created: its detail page, or — for a secret, which has none — its project's
 * secrets, or the secrets list for a secret without a project.
 */
@Component({
  selector: "sm-new-menu",
  standalone: true,
  templateUrl: "./sm-new-menu.component.html",
  imports: [ButtonModule, MenuModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmNewMenuComponent {
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly router = inject(Router);
  private readonly events = inject(SmEventsService);
  private readonly context = routeParams(inject(ActivatedRoute));
  private readonly organizationId = this.context.organizationId;

  protected async newProject(): Promise<void> {
    const ref = openProjectDialog(this.dialogService, {
      data: { organizationId: this.organizationId },
    });
    await this.created(await lastValueFrom(ref.closed), "projectCreated", (id) => ["projects", id]);
  }

  protected async newSecret(): Promise<void> {
    // On a project page the new secret goes into that project unless the user picks another.
    const ref = openSecretDialog(this.dialogService, {
      data: { organizationId: this.organizationId, projectId: this.context.projectId },
    });
    // A secret has no page of its own: show it among its project's secrets, or in the list if it has none.
    await this.created(await lastValueFrom(ref.closed), "secretCreated", (secret) =>
      secret.projectId ? ["projects", secret.projectId, "secrets"] : ["secrets"],
    );
  }

  protected async newMachineAccount(): Promise<void> {
    const ref = openMachineAccountDialog(this.dialogService, {
      data: { organizationId: this.organizationId },
    });
    await this.created(await lastValueFrom(ref.closed), "machineAccountCreated", (id) => [
      "machine-accounts",
      id,
    ]);
  }

  /** After a create dialog closes: confirm, go to the new object, and refresh lists already shown. */
  private async created<T>(
    result: T | undefined,
    messageKey: string,
    target: (result: T) => string[],
  ): Promise<void> {
    if (!result) {
      return;
    }
    this.toastService.showToast({ variant: "success", message: this.i18nService.t(messageKey) });
    await this.router.navigate(["/sm", this.organizationId, ...target(result)]);
    // Navigating to the page already open (a secret created on a secrets list) does not reload it.
    this.events.notify();
  }
}
