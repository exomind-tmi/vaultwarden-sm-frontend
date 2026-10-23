import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { AccessEditorComponent } from "./access-editor.component";
import { AccessPolicyService } from "./access-policy.service";
import { routeParams } from "./sm-route-params";

/** The People tab of a project: the organization members with access to it. */
@Component({
  selector: "sm-project-people",
  standalone: true,
  template: `<sm-access-editor
    hint="Grant organization members access to this project."
    emptyMessage="No people have access to this project."
    writeMode="choice"
    [load]="load"
    [listGrantees]="listGrantees"
    [save]="save"
  ></sm-access-editor>`,
  imports: [AccessEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectPeopleComponent {
  private readonly policyService = inject(AccessPolicyService);
  private readonly params = routeParams(inject(ActivatedRoute));

  protected readonly load = () => this.policyService.getProjectPeople(this.params.projectId);
  protected readonly listGrantees = () => this.policyService.listOrgMembers(this.params.organizationId);
  protected readonly save = (grants: { id: string; read: boolean; write: boolean }[]) =>
    this.policyService.putProjectPeople(this.params.projectId, grants);
}
