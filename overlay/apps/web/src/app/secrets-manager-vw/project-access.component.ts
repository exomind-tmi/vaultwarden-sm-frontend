import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { I18nPipe } from "@bitwarden/ui-common";

import { AccessEditorComponent, AccessSource } from "./access-editor.component";
import { AccessPolicyService } from "./access-policy.service";
import { routeParams } from "./sm-route-params";

/** The Access tab of a project: the people and machine accounts that can reach its secrets. */
@Component({
  selector: "sm-project-access",
  standalone: true,
  template: `<sm-access-editor
    [hint]="'smProjectAccessDescription' | i18n"
    [label]="'smPeopleOrMachineAccounts' | i18n"
    [selectHint]="'smProjectAccessSelectHint' | i18n"
    [emptyMessage]="'smProjectAccessEmpty' | i18n"
    [savedMessage]="'projectAccessUpdated' | i18n"
    [sources]="sources"
  ></sm-access-editor>`,
  imports: [AccessEditorComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectAccessComponent {
  private readonly policyService = inject(AccessPolicyService);
  private readonly params = routeParams(inject(ActivatedRoute));

  protected readonly sources: AccessSource[] = [
    {
      kind: "person",
      load: () => this.policyService.getProjectPeople(this.params.projectId),
      listGrantees: () => this.policyService.listOrgMembers(this.params.organizationId),
      save: (grants) => this.policyService.putProjectPeople(this.params.projectId, grants),
    },
    {
      kind: "machineAccount",
      load: () => this.policyService.getProjectServiceAccounts(this.params.projectId),
      listGrantees: () => this.policyService.listServiceAccountGrantees(this.params.organizationId),
      save: (grants) => this.policyService.putProjectServiceAccounts(this.params.projectId, grants),
    },
  ];
}
