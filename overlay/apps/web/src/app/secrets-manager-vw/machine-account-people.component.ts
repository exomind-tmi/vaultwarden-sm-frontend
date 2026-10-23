import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { I18nPipe } from "@bitwarden/ui-common";

import { AccessEditorComponent } from "./access-editor.component";
import { AccessPolicyService } from "./access-policy.service";
import { routeParams } from "./sm-route-params";

/** The People tab of a machine account: the members who manage it (always read + write). */
@Component({
  selector: "sm-machine-account-people",
  standalone: true,
  template: `<sm-access-editor
    [hint]="'machineAccountPeopleDescription' | i18n"
    [emptyMessage]="'projectEmptyPeopleAccessPolicies' | i18n"
    [savedMessage]="'machineAccountAccessUpdated' | i18n"
    writeMode="forced"
    [load]="load"
    [listGrantees]="listGrantees"
    [save]="save"
  ></sm-access-editor>`,
  imports: [AccessEditorComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineAccountPeopleComponent {
  private readonly policyService = inject(AccessPolicyService);
  private readonly params = routeParams(inject(ActivatedRoute));

  protected readonly load = () =>
    this.policyService.getServiceAccountPeople(this.params.machineAccountId);
  protected readonly listGrantees = () =>
    this.policyService.listOrgMembers(this.params.organizationId);
  protected readonly save = (grants: { id: string; read: boolean; write: boolean }[]) =>
    this.policyService.putServiceAccountPeople(this.params.machineAccountId, grants);
}
