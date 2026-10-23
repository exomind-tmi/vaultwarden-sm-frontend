import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";

import { SecretsManagerLogo } from "@bitwarden/assets/svg";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrgSwitcherComponent } from "@bitwarden/web-vault/app/layouts/org-switcher/org-switcher.component";
import { WebLayoutModule } from "@bitwarden/web-vault/app/layouts/web-layout.module";

/** The Secrets Manager left navigation: organization switcher over the section links. */
@Component({
  selector: "sm-navigation",
  standalone: true,
  templateUrl: "./navigation.component.html",
  imports: [CommonModule, RouterModule, WebLayoutModule, OrgSwitcherComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationComponent {
  protected readonly route = inject(ActivatedRoute);

  protected readonly logo = SecretsManagerLogo;
  // In this overlay the Secrets Manager is available to every organization the user belongs to, so
  // the switcher is not gated on the (vaultwarden-absent) canAccessSecretsManager flag.
  protected readonly orgFilter = (org: Organization) => org.enabled;
}
