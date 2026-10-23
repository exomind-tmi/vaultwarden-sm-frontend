import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { AccessEditorComponent } from "./access-editor.component";
import { AccessPolicyService } from "./access-policy.service";
import { routeParams } from "./sm-route-params";

/** The Machine accounts tab of a project: the machine accounts with access to it. */
@Component({
  selector: "sm-project-machine-accounts",
  standalone: true,
  template: `<sm-access-editor
    hint="Grant machine accounts access to this project."
    emptyMessage="No machine accounts have access to this project."
    writeMode="choice"
    [load]="load"
    [listGrantees]="listGrantees"
    [save]="save"
  ></sm-access-editor>`,
  imports: [AccessEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectMachineAccountsComponent {
  private readonly policyService = inject(AccessPolicyService);
  private readonly params = routeParams(inject(ActivatedRoute));

  protected readonly load = () =>
    this.policyService.getProjectServiceAccounts(this.params.projectId);
  protected readonly listGrantees = () =>
    this.policyService.listServiceAccountGrantees(this.params.organizationId);
  protected readonly save = (grants: { id: string; read: boolean; write: boolean }[]) =>
    this.policyService.putProjectServiceAccounts(this.params.projectId, grants);
}
