import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { I18nPipe } from "@bitwarden/ui-common";

import { AccessEditorComponent } from "./access-editor.component";
import { AccessPolicyService } from "./access-policy.service";
import { routeParams } from "./sm-route-params";

/** The Projects tab of a machine account: the projects it is granted. */
@Component({
  selector: "sm-machine-account-projects",
  standalone: true,
  template: `<sm-access-editor
    [hint]="'machineAccountProjectsDescription' | i18n"
    [emptyMessage]="'serviceAccountEmptyProjectAccesspolicies' | i18n"
    [savedMessage]="'machineAccountAccessUpdated' | i18n"
    writeMode="choice"
    [load]="load"
    [listGrantees]="listGrantees"
    [save]="save"
  ></sm-access-editor>`,
  imports: [AccessEditorComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineAccountProjectsComponent {
  private readonly policyService = inject(AccessPolicyService);
  private readonly params = routeParams(inject(ActivatedRoute));

  protected readonly load = () =>
    this.policyService.getServiceAccountGrantedProjects(this.params.machineAccountId);
  protected readonly listGrantees = () =>
    this.policyService.listProjectGrantees(this.params.organizationId);
  protected readonly save = (grants: { id: string; read: boolean; write: boolean }[]) =>
    this.policyService.putServiceAccountGrantedProjects(this.params.machineAccountId, grants);
}
