import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { AccessTokensPanelComponent } from "./access-tokens-panel.component";
import { routeParams } from "./sm-route-params";

/** The Access tokens tab of a machine account. */
@Component({
  selector: "sm-machine-account-tokens",
  standalone: true,
  template: `<div class="tw-pt-6">
    <sm-access-tokens-panel
      [organizationId]="params.organizationId"
      [machineAccountId]="params.machineAccountId"
    ></sm-access-tokens-panel>
  </div>`,
  imports: [AccessTokensPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineAccountTokensComponent {
  protected readonly params = routeParams(inject(ActivatedRoute));
}
