import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * Placeholder landing for the clean-room Secrets Manager module, mounted at `/sm`.
 *
 * It exists to prove the overlay pipeline end to end: the route resolves inside the authenticated
 * web-vault shell and renders. The real SM screens (projects, secrets, machine accounts, access
 * policies) replace this component in a later step, reusing only open `@bitwarden/*` libraries.
 */
@Component({
  standalone: true,
  selector: "vwsm-sm-home",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-p-6">
      <h1 class="tw-text-main tw-text-2xl tw-font-semibold">Secrets Manager</h1>
      <p class="tw-text-muted tw-mt-2">
        vaultwarden-sm overlay is wired. The Secrets Manager module loads here.
      </p>
    </div>
  `,
})
export class SmHomeComponent {}
