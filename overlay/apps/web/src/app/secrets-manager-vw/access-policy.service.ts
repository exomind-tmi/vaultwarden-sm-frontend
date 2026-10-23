import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports -- these live only in @bitwarden/legacy-crypto at this version
import { EncryptService, EncString } from "@bitwarden/legacy-crypto";

const SM_API_URL = "/sm-api/api";
/** Organization members come from vaultwarden itself, not the Secrets Manager backend. */
const VW_API_URL = "/api";

/** A candidate for a grant: a person, a machine account, or a project. */
export interface GranteeView {
  id: string;
  name: string;
  email?: string;
}

/** A single grant with its rights. For people, `id` is the organization-user id. */
export interface GrantView {
  id: string;
  name: string;
  read: boolean;
  write: boolean;
  currentUser: boolean;
}

interface GrantRequest {
  id: string;
  read: boolean;
  write: boolean;
}

/**
 * Granular access policies for projects and machine accounts. Four relationships, each read with a
 * GET and replaced wholesale with a PUT. The backend never returns grantee display names, so names
 * are resolved here: people from vaultwarden's own member list (plaintext), projects and machine
 * accounts from the Secrets Manager potential-grantee lists (names encrypted under the org key).
 */
@Injectable({ providedIn: "root" })
export class AccessPolicyService {
  private readonly apiService = inject(ApiService);
  private readonly accountService = inject(AccountService);
  private readonly keyService = inject(KeyService);
  private readonly encryptService = inject(EncryptService);

  // --- people on a project ---

  async getProjectPeople(projectId: string): Promise<GrantView[]> {
    const r = await this.get(`/projects/${projectId}/access-policies/people`);
    return this.peopleGrants(r);
  }

  async putProjectPeople(projectId: string, grants: GrantRequest[]): Promise<void> {
    await this.put(`/projects/${projectId}/access-policies/people`, {
      userAccessPolicyRequests: this.userRequests(grants),
    });
  }

  // --- people on a machine account (always read + write) ---

  async getServiceAccountPeople(machineAccountId: string): Promise<GrantView[]> {
    const r = await this.get(`/service-accounts/${machineAccountId}/access-policies/people`);
    return this.peopleGrants(r);
  }

  async putServiceAccountPeople(machineAccountId: string, grants: GrantRequest[]): Promise<void> {
    await this.put(`/service-accounts/${machineAccountId}/access-policies/people`, {
      userAccessPolicyRequests: this.userRequests(grants),
    });
  }

  // --- machine accounts on a project ---

  async getProjectServiceAccounts(projectId: string): Promise<GrantView[]> {
    const r = await this.get(`/projects/${projectId}/access-policies/service-accounts`);
    return (r?.serviceAccountAccessPolicies ?? []).map((p: any) => ({
      id: p.serviceAccountId,
      name: "",
      read: p.read,
      write: p.write,
      currentUser: false,
    }));
  }

  async putProjectServiceAccounts(projectId: string, grants: GrantRequest[]): Promise<void> {
    await this.put(`/projects/${projectId}/access-policies/service-accounts`, {
      serviceAccountAccessPolicyRequests: this.granteeRequests(grants),
    });
  }

  // --- projects granted to a machine account ---

  async getServiceAccountGrantedProjects(machineAccountId: string): Promise<GrantView[]> {
    const r = await this.get(`/service-accounts/${machineAccountId}/granted-policies`);
    return (r?.grantedProjectPolicies ?? []).map((p: any) => ({
      id: p.accessPolicy.grantedProjectId,
      name: "",
      read: p.accessPolicy.read,
      write: p.accessPolicy.write,
      currentUser: false,
    }));
  }

  async putServiceAccountGrantedProjects(
    machineAccountId: string,
    grants: GrantRequest[],
  ): Promise<void> {
    await this.put(`/service-accounts/${machineAccountId}/granted-policies`, {
      projectGrantedPolicyRequests: grants.map((g) => ({
        grantedId: g.id,
        read: g.read,
        write: g.write,
      })),
    });
  }

  // --- grantee sources ---

  async listOrgMembers(organizationId: string): Promise<GranteeView[]> {
    const r = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/users`,
      null,
      true,
      true,
      VW_API_URL,
    );
    return (r?.data ?? []).map((m: any) => ({
      id: m.id,
      name: m.name || m.email,
      email: m.email,
    }));
  }

  async listProjectGrantees(organizationId: string): Promise<GranteeView[]> {
    return this.potentialGrantees(organizationId, "projects");
  }

  async listServiceAccountGrantees(organizationId: string): Promise<GranteeView[]> {
    return this.potentialGrantees(organizationId, "service-accounts");
  }

  private async potentialGrantees(
    organizationId: string,
    kind: "projects" | "service-accounts",
  ): Promise<GranteeView[]> {
    const orgKey = await this.orgKey(organizationId);
    const r = await this.get(
      `/organizations/${organizationId}/access-policies/${kind}/potential-grantees`,
    );
    return Promise.all(
      (r?.data ?? []).map(async (g: any) => ({
        id: g.id,
        name: await this.dec(g.name, orgKey),
      })),
    );
  }

  // --- shared helpers ---

  private peopleGrants(r: any): GrantView[] {
    return (r?.userAccessPolicies ?? []).map((p: any) => ({
      id: p.organizationUserId,
      name: "",
      read: p.read,
      write: p.write,
      currentUser: p.currentUser === true,
    }));
  }

  private userRequests(grants: GrantRequest[]) {
    return grants.map((g) => ({ granteeId: g.id, read: g.read, write: g.write }));
  }

  private granteeRequests(grants: GrantRequest[]) {
    return grants.map((g) => ({ granteeId: g.id, read: g.read, write: g.write }));
  }

  private get(path: string): Promise<any> {
    return this.apiService.send("GET", path, null, true, true, SM_API_URL);
  }

  private put(path: string, body: unknown): Promise<any> {
    return this.apiService.send("PUT", path, body, true, true, SM_API_URL);
  }

  private async dec(enc: string, key: OrgKey): Promise<string> {
    return this.encryptService.decryptString(new EncString(enc), key);
  }

  private async orgKey(organizationId: string): Promise<OrgKey> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const orgKeys = await firstValueFrom(this.keyService.orgKeys$(userId));
    const orgKey = orgKeys?.[organizationId as OrganizationId];
    if (orgKey == null) {
      throw new Error("Organization key unavailable.");
    }
    return orgKey;
  }
}
