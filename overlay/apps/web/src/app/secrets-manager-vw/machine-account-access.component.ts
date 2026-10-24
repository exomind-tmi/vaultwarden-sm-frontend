import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { I18nPipe } from "@bitwarden/ui-common";

import { AccessEditorComponent, AccessSource } from "./access-editor.component";
import { AccessPolicyService } from "./access-policy.service";
import { routeParams } from "./sm-route-params";

/** The Access tab of a machine account: the people who manage it (always read + write). */
@Component({
  selector: "sm-machine-account-access",
  standalone: true,
  template: `<sm-access-editor
    [hint]="'machineAccountPeopleDescription' | i18n"
    [label]="'users' | i18n"
    [selectHint]="'smPeopleSelectHint' | i18n"
    [emptyMessage]="'projectEmptyPeopleAccessPolicies' | i18n"
    [savedMessage]="'machineAccountAccessUpdated' | i18n"
    [sources]="sources"
    writeMode="forced"
  ></sm-access-editor>`,
  imports: [AccessEditorComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineAccountAccessComponent {
  private readonly policyService = inject(AccessPolicyService);
  private readonly params = routeParams(inject(ActivatedRoute));

  protected readonly sources: AccessSource[] = [
    {
      kind: "person",
      load: () => this.policyService.getServiceAccountPeople(this.params.machineAccountId),
      listGrantees: () => this.policyService.listOrgMembers(this.params.organizationId),
      save: (grants) =>
        this.policyService.putServiceAccountPeople(this.params.machineAccountId, grants),
    },
  ];
}
