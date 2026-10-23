import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";

import { AccessListComponent } from "./access-list.component";
import { AccessPolicyService } from "./access-policy.service";
import { AccessTokensPanelComponent } from "./access-tokens-panel.component";
import { MachineAccountService } from "./machine-account.service";

type Tab = "tokens" | "people" | "projects";

/** A machine account's page: its access tokens, the people who manage it, and the projects it is granted. */
@Component({
  selector: "sm-machine-account-detail",
  standalone: true,
  templateUrl: "./machine-account-detail.component.html",
  imports: [CommonModule, RouterLink, AccessListComponent, AccessTokensPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineAccountDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly machineAccountService = inject(MachineAccountService);
  private readonly policyService = inject(AccessPolicyService);

  protected readonly organizationId = this.route.snapshot.params.organizationId as string;
  protected readonly machineAccountId = this.route.snapshot.params.machineAccountId as string;

  protected readonly tab = signal<Tab>("tokens");
  protected readonly tabs: { key: Tab; label: string }[] = [
    { key: "tokens", label: "Access tokens" },
    { key: "people", label: "People" },
    { key: "projects", label: "Projects" },
  ];
  protected readonly name = signal("");

  // Stable access-list configs (captured once by the child in ngOnInit).
  protected readonly peopleLoad = () =>
    this.policyService.getServiceAccountPeople(this.machineAccountId);
  protected readonly peopleGrantees = () => this.policyService.listOrgMembers(this.organizationId);
  protected readonly peopleSave = (grants: { id: string; read: boolean; write: boolean }[]) =>
    this.policyService.putServiceAccountPeople(this.machineAccountId, grants);

  protected readonly projectsLoad = () =>
    this.policyService.getServiceAccountGrantedProjects(this.machineAccountId);
  protected readonly projectsGrantees = () => this.policyService.listProjectGrantees(this.organizationId);
  protected readonly projectsSave = (grants: { id: string; read: boolean; write: boolean }[]) =>
    this.policyService.putServiceAccountGrantedProjects(this.machineAccountId, grants);

  constructor() {
    void this.loadName();
  }

  private async loadName(): Promise<void> {
    try {
      const machineAccounts = await this.machineAccountService.list(this.organizationId);
      this.name.set(machineAccounts.find((m) => m.id === this.machineAccountId)?.name ?? "");
    } catch {
      /* the header simply shows no name if the lookup fails */
    }
  }
}
