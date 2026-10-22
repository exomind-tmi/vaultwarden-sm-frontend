import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports -- EncryptService/EncString live only in @bitwarden/legacy-crypto at this version
import { EncryptService, EncString } from "@bitwarden/legacy-crypto";

/**
 * Same-origin base for the Secrets Manager backend. The companion web server (Caddy) reverse-proxies
 * `/sm-api/*` to the vaultwarden-sm backend, stripping the prefix, so the backend sees `/api/...`.
 */
const SM_API_URL = "/sm-api/api";

/** A project with its name already decrypted with the organization key. */
export interface ProjectView {
  id: string;
  name: string;
  creationDate: string;
  revisionDate: string;
}

/**
 * Talks to the vaultwarden-sm backend for projects. Project names are encrypted with the
 * organization key before leaving the browser and decrypted on the way back, so the backend is a
 * zero-knowledge store. Auth rides the user's existing vaultwarden session: `ApiService.send` with
 * `authed = true` attaches the bearer token (and refreshes it on 401) automatically.
 */
@Injectable({ providedIn: "root" })
export class ProjectService {
  private readonly apiService = inject(ApiService);
  private readonly accountService = inject(AccountService);
  private readonly keyService = inject(KeyService);
  private readonly encryptService = inject(EncryptService);

  async list(organizationId: string): Promise<ProjectView[]> {
    const orgKey = await this.orgKey(organizationId);
    const response = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/projects`,
      null,
      true,
      true,
      SM_API_URL,
    );
    const rows: any[] = response?.data ?? [];
    return Promise.all(
      rows.map(async (p) => ({
        id: p.id,
        name: await this.encryptService.decryptString(new EncString(p.name), orgKey),
        creationDate: p.creationDate,
        revisionDate: p.revisionDate,
      })),
    );
  }

  async create(organizationId: string, name: string): Promise<void> {
    const orgKey = await this.orgKey(organizationId);
    const encName = (await this.encryptService.encryptString(name, orgKey)).encryptedString;
    await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/projects`,
      { name: encName },
      true,
      true,
      SM_API_URL,
    );
  }

  async update(organizationId: string, id: string, name: string): Promise<void> {
    const orgKey = await this.orgKey(organizationId);
    const encName = (await this.encryptService.encryptString(name, orgKey)).encryptedString;
    await this.apiService.send("PUT", `/projects/${id}`, { name: encName }, true, true, SM_API_URL);
  }

  async delete(ids: string[]): Promise<void> {
    await this.apiService.send("POST", `/projects/delete`, ids, true, false, SM_API_URL);
  }

  private async orgKey(organizationId: string) {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const orgKeys = await firstValueFrom(this.keyService.orgKeys$(userId));
    const orgKey = orgKeys?.[organizationId as OrganizationId];
    if (orgKey == null) {
      throw new Error("Organization key unavailable.");
    }
    return orgKey;
  }
}
