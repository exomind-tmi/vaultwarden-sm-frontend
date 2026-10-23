import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, Input, OnInit, signal } from "@angular/core";

import { ButtonModule, IconButtonModule, ToastService } from "@bitwarden/components";

import { GranteeView, GrantView } from "./access-policy.service";

export type WriteMode = "optional" | "forced";

/** Replaces the whole grant set for one relationship (project people, a machine account's projects, …). */
export type SaveGrants = (grants: { id: string; read: boolean; write: boolean }[]) => Promise<void>;

/**
 * Inline editor for one access relationship, applied instantly: picking a grantee adds it, toggling
 * write flips it, and the × removes it — each change is persisted immediately (every PUT replaces the
 * whole set, so one small request per edit). There is no Save button and no dirty state. `writeMode`
 * "forced" means every grant is read + write and the toggle is hidden (people on a machine account).
 */
@Component({
  selector: "sm-access-list",
  standalone: true,
  templateUrl: "./access-list.component.html",
  imports: [CommonModule, ButtonModule, IconButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessListComponent implements OnInit {
  @Input({ required: true }) emptyText!: string;
  @Input() writeMode: WriteMode = "optional";
  @Input({ required: true }) load!: () => Promise<GrantView[]>;
  @Input({ required: true }) listGrantees!: () => Promise<GranteeView[]>;
  @Input({ required: true }) save!: SaveGrants;
  /** A stable id so the <input>/<datalist> pairing is unique when several lists share a page. */
  @Input({ required: true }) listId!: string;

  private readonly toastService = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly rows = signal<GrantView[]>([]);
  protected readonly grantees = signal<GranteeView[]>([]);
  protected readonly available = computed(() =>
    this.grantees()
      .filter((g) => !this.rows().some((r) => r.id === g.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  ngOnInit(): void {
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const [grantees, grants] = await Promise.all([this.listGrantees(), this.load()]);
      this.grantees.set(grantees);
      const byId = new Map(grantees.map((g) => [g.id, g.name]));
      this.rows.set(grants.map((g) => ({ ...g, name: byId.get(g.id) ?? g.name ?? g.id })));
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  /** Commit the <input> against the datalist: add the grantee whose name was picked. */
  protected async addByName(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const name = input.value.trim();
    const grantee = this.available().find((g) => g.name === name);
    input.value = "";
    if (grantee == null) {
      return;
    }
    const next = [
      ...this.rows(),
      {
        id: grantee.id,
        name: grantee.name,
        read: true,
        write: this.writeMode === "forced",
        currentUser: false,
      },
    ];
    await this.persist(next);
  }

  protected async toggleWrite(id: string): Promise<void> {
    await this.persist(this.rows().map((r) => (r.id === id ? { ...r, write: !r.write } : r)));
  }

  protected async remove(id: string): Promise<void> {
    await this.persist(this.rows().filter((r) => r.id !== id));
  }

  private async persist(next: GrantView[]): Promise<void> {
    const previous = this.rows();
    this.rows.set(next); // optimistic
    this.busy.set(true);
    try {
      await this.save(next.map((r) => ({ id: r.id, read: r.read, write: r.write })));
    } catch {
      this.rows.set(previous); // roll back on failure
      this.toastService.showToast({ variant: "error", message: "Failed to save access." });
    } finally {
      this.busy.set(false);
    }
  }
}
