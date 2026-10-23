import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { RouterModule } from "@angular/router";
import { distinctUntilChanged, map, Observable, switchMap } from "rxjs";

import { SecretsManagerLogo } from "@bitwarden/assets/svg";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
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
  private readonly organizationService = inject(OrganizationService);
  private readonly accountService = inject(AccountService);

  protected readonly logo = SecretsManagerLogo;
  // In this overlay the Secrets Manager is available to every organization the user belongs to, so
  // the switcher is not gated on the (vaultwarden-absent) canAccessSecretsManager flag.
  protected readonly orgFilter = (org: Organization) => org.enabled;

  private readonly org$: Observable<Organization | undefined> = this.route.params.pipe(
    switchMap((params) =>
      getUserId(this.accountService.activeAccount$).pipe(
        switchMap((userId) =>
          this.organizationService
            .organizations$(userId)
            .pipe(getOrganizationById(params.organizationId)),
        ),
      ),
    ),
    distinctUntilChanged((prev, curr) => prev?.id === curr?.id),
  );

  protected readonly isAdmin$ = this.org$.pipe(map((org) => org?.isAdmin ?? false));
}
