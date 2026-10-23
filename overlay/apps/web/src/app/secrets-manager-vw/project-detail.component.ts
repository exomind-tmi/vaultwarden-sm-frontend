import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";

import { AccessListComponent } from "./access-list.component";
import { AccessPolicyService } from "./access-policy.service";
import { ProjectService } from "./project.service";
import { SecretListView, SecretService } from "./secret.service";

type Tab = "secrets" | "people" | "machine-accounts";

/** A project's page: its secrets, the people with access, and the machine accounts with access. */
@Component({
  selector: "sm-project-detail",
  standalone: true,
  templateUrl: "./project-detail.component.html",
  imports: [CommonModule, RouterLink, AccessListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly projectService = inject(ProjectService);
  private readonly secretService = inject(SecretService);
  private readonly policyService = inject(AccessPolicyService);

  protected readonly organizationId = this.route.snapshot.params.organizationId as string;
  protected readonly projectId = this.route.snapshot.params.projectId as string;

  protected readonly tab = signal<Tab>("secrets");
  protected readonly tabs: { key: Tab; label: string }[] = [
    { key: "secrets", label: "Secrets" },
    { key: "people", label: "People" },
    { key: "machine-accounts", label: "Machine accounts" },
  ];
  protected readonly name = signal("");
  protected readonly loadingSecrets = signal(true);
  protected readonly secretsFailed = signal(false);
  protected readonly secrets = signal<SecretListView[]>([]);

  // Access-list configs are stable references (the component captures them once, in ngOnInit).
  protected readonly peopleLoad = () => this.policyService.getProjectPeople(this.projectId);
  protected readonly peopleGrantees = () => this.policyService.listOrgMembers(this.organizationId);
  protected readonly peopleSave = (grants: { id: string; read: boolean; write: boolean }[]) =>
    this.policyService.putProjectPeople(this.projectId, grants);

  protected readonly machinesLoad = () => this.policyService.getProjectServiceAccounts(this.projectId);
  protected readonly machinesGrantees = () =>
    this.policyService.listServiceAccountGrantees(this.organizationId);
  protected readonly machinesSave = (grants: { id: string; read: boolean; write: boolean }[]) =>
    this.policyService.putProjectServiceAccounts(this.projectId, grants);

  constructor() {
    void this.loadName();
    void this.loadSecrets();
  }

  private async loadName(): Promise<void> {
    try {
      const projects = await this.projectService.list(this.organizationId);
      this.name.set(projects.find((p) => p.id === this.projectId)?.name ?? "");
    } catch {
      /* the header simply shows no name if the lookup fails */
    }
  }

  private async loadSecrets(): Promise<void> {
    this.loadingSecrets.set(true);
    this.secretsFailed.set(false);
    try {
      const all = await this.secretService.list(this.organizationId);
      this.secrets.set(all.filter((s) => s.projects.some((p) => p.id === this.projectId)));
    } catch {
      this.secretsFailed.set(true);
      this.secrets.set([]);
    } finally {
      this.loadingSecrets.set(false);
    }
  }
}
