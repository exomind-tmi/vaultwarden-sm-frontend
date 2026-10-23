import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports -- these live only in @bitwarden/legacy-crypto at this version
import { EncryptService, EncString, KeyGenerationService } from "@bitwarden/legacy-crypto";

const SM_API_URL = "/sm-api/api";

export interface MachineAccountView {
  id: string;
  name: string;
  creationDate: string;
  revisionDate: string;
}

export interface AccessTokenView {
  id: string;
  name: string;
  scopes: string[];
  expireAt: string | null;
  creationDate: string;
}

/**
 * Machine accounts (service accounts) and their access tokens. Access-token issuance mirrors `bws`
 * byte-for-byte: a per-token key is generated in the browser, the organization key is wrapped under
 * it (the payload `bws` later decrypts) and the per-token key is wrapped under the organization key
 * (for recovery); the backend only returns the client secret. The full token string is assembled
 * here and shown once — the backend never sees it.
 */
@Injectable({ providedIn: "root" })
export class MachineAccountService {
  private readonly apiService = inject(ApiService);
  private readonly accountService = inject(AccountService);
  private readonly keyService = inject(KeyService);
  private readonly encryptService = inject(EncryptService);
  private readonly keyGenerationService = inject(KeyGenerationService);

  async list(organizationId: string): Promise<MachineAccountView[]> {
    const orgKey = await this.orgKey(organizationId);
    const r = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/service-accounts`,
      null,
      true,
      true,
      SM_API_URL,
    );
    return Promise.all(
      (r?.data ?? []).map(async (m: any) => ({
        id: m.id,
        name: await this.dec(m.name, orgKey),
        creationDate: m.creationDate,
        revisionDate: m.revisionDate,
      })),
    );
  }

  async create(organizationId: string, name: string): Promise<void> {
    const orgKey = await this.orgKey(organizationId);
    await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/service-accounts`,
      { name: await this.enc(name, orgKey) },
      true,
      true,
      SM_API_URL,
    );
  }

  async update(organizationId: string, id: string, name: string): Promise<void> {
    const orgKey = await this.orgKey(organizationId);
    await this.apiService.send(
      "PUT",
      `/service-accounts/${id}`,
      { name: await this.enc(name, orgKey) },
      true,
      true,
      SM_API_URL,
    );
  }

  async delete(ids: string[]): Promise<void> {
    await this.apiService.send("POST", `/service-accounts/delete`, ids, true, true, SM_API_URL);
  }

  async listTokens(organizationId: string, serviceAccountId: string): Promise<AccessTokenView[]> {
    const orgKey = await this.orgKey(organizationId);
    const r = await this.apiService.send(
      "GET",
      `/service-accounts/${serviceAccountId}/access-tokens`,
      null,
      true,
      true,
      SM_API_URL,
    );
    return Promise.all(
      (r?.data ?? []).map(async (t: any) => ({
        id: t.id,
        name: await this.dec(t.name, orgKey),
        scopes: t.scopes ?? [],
        expireAt: t.expireAt ?? null,
        creationDate: t.creationDate,
      })),
    );
  }

  /** Issues an access token and returns its one-time string `0.<id>.<clientSecret>:<base64 seed>`. */
  async createToken(
    organizationId: string,
    serviceAccountId: string,
    name: string,
  ): Promise<string> {
    const orgKey = await this.orgKey(organizationId);
    const tokenKey = await this.keyGenerationService.createKeyWithPurpose(
      128,
      "sm-access-token",
      "bitwarden-accesstoken",
    );
    const [encName, encryptedPayload, wrappedKey] = await Promise.all([
      this.encryptService.encryptString(name, orgKey),
      this.encryptService.encryptString(
        JSON.stringify({ encryptionKey: orgKey.keyB64 }),
        tokenKey.derivedKey,
      ),
      this.encryptService.encryptString(tokenKey.derivedKey.keyB64, orgKey),
    ]);
    const r = await this.apiService.send(
      "POST",
      `/service-accounts/${serviceAccountId}/access-tokens`,
      {
        name: encName.encryptedString,
        encryptedPayload: encryptedPayload.encryptedString,
        key: wrappedKey.encryptedString,
        expireAt: null,
      },
      true,
      true,
      SM_API_URL,
    );
    const seed = Utils.fromBufferToB64(tokenKey.material);
    return `0.${r.id}.${r.clientSecret}:${seed}`;
  }

  async revokeToken(serviceAccountId: string, tokenId: string): Promise<void> {
    await this.apiService.send(
      "POST",
      `/service-accounts/${serviceAccountId}/access-tokens/revoke`,
      { ids: [tokenId] },
      true,
      false,
      SM_API_URL,
    );
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
