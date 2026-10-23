import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports -- EncryptService/EncString live only in @bitwarden/legacy-crypto at this version
import { EncryptService, EncString } from "@bitwarden/legacy-crypto";

const SM_API_URL = "/sm-api/api";

export interface SecretProjectRef {
  id: string;
  name: string;
}

/** A secret in the list view: metadata only (no value/note). */
export interface SecretListView {
  id: string;
  key: string;
  projects: SecretProjectRef[];
  creationDate: string;
  revisionDate: string;
}

/** A single secret with its decrypted value and note. */
export interface SecretView extends SecretListView {
  value: string;
  note: string;
}

export interface SecretInput {
  key: string;
  value: string;
  note: string;
  projectIds: string[];
}

/**
 * Secrets for an organization. Key, value and note are encrypted with the organization key before
 * leaving the browser; the backend stores them opaquely. The list omits value/note, so editing a
 * secret fetches it individually.
 */
@Injectable({ providedIn: "root" })
export class SecretService {
  private readonly apiService = inject(ApiService);
  private readonly accountService = inject(AccountService);
  private readonly keyService = inject(KeyService);
  private readonly encryptService = inject(EncryptService);

  async list(organizationId: string): Promise<SecretListView[]> {
    const orgKey = await this.orgKey(organizationId);
    const response = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/secrets`,
      null,
      true,
      true,
      SM_API_URL,
    );
    const names = new Map<string, string>();
    for (const p of response?.projects ?? []) {
      names.set(p.id, await this.dec(p.name, orgKey));
    }
    return Promise.all(
      (response?.secrets ?? []).map(async (s: any) => ({
        id: s.id,
        key: await this.dec(s.key, orgKey),
        projects: (s.projects ?? []).map((p: any) => ({ id: p.id, name: names.get(p.id) ?? "" })),
        creationDate: s.creationDate,
        revisionDate: s.revisionDate,
      })),
    );
  }

  async get(organizationId: string, id: string): Promise<SecretView> {
    const orgKey = await this.orgKey(organizationId);
    const s = await this.apiService.send("GET", `/secrets/${id}`, null, true, true, SM_API_URL);
    return {
      id: s.id,
      key: await this.dec(s.key, orgKey),
      value: await this.dec(s.value, orgKey),
      note: s.note ? await this.dec(s.note, orgKey) : "",
      projects: await Promise.all(
        (s.projects ?? []).map(async (p: any) => ({
          id: p.id,
          name: await this.dec(p.name, orgKey),
        })),
      ),
      creationDate: s.creationDate,
      revisionDate: s.revisionDate,
    };
  }

  /** Creates the secret and returns its id. */
  async create(organizationId: string, input: SecretInput): Promise<string> {
    const body = await this.body(organizationId, input);
    const r = await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/secrets`,
      body,
      true,
      true,
      SM_API_URL,
    );
    return r.id;
  }

  async update(organizationId: string, id: string, input: SecretInput): Promise<void> {
    const body = await this.body(organizationId, input);
    await this.apiService.send("PUT", `/secrets/${id}`, body, true, true, SM_API_URL);
  }

  async delete(ids: string[]): Promise<void> {
    await this.apiService.send("POST", `/secrets/delete`, ids, true, false, SM_API_URL);
  }

  private async body(organizationId: string, input: SecretInput) {
    const orgKey = await this.orgKey(organizationId);
    return {
      key: await this.enc(input.key, orgKey),
      value: await this.enc(input.value, orgKey),
      note: await this.enc(input.note, orgKey),
      projectIds: input.projectIds,
    };
  }

  private async enc(plain: string, key: OrgKey): Promise<string> {
    return (await this.encryptService.encryptString(plain, key)).encryptedString;
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
