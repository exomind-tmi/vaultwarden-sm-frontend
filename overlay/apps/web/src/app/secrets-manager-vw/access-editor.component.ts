import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Input,
  OnInit,
  signal,
} from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  IconButtonModule,
  TableDataSource,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { GranteeView, GrantView } from "./access-policy.service";

export type AccessWriteMode = "choice" | "forced";
export type SaveGrants = (grants: { id: string; read: boolean; write: boolean }[]) => Promise<void>;

/**
 * Save-based editor for one access relationship (project people, a machine account's projects, …):
 * a grantee is picked and added, its permission is chosen per row, and the whole set is persisted
 * when Save is pressed. `writeMode` "forced" means every grant is read + write (people on a machine
 * account), so the permission is fixed.
 */
@Component({
  selector: "sm-access-editor",
  standalone: true,
  templateUrl: "./access-editor.component.html",
  imports: [CommonModule, ButtonModule, IconButtonModule, TableModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessEditorComponent implements OnInit {
  @Input({ required: true }) hint!: string;
  @Input({ required: true }) emptyMessage!: string;
  @Input({ required: true }) savedMessage!: string;
  @Input() writeMode: AccessWriteMode = "choice";
  @Input({ required: true }) load!: () => Promise<GrantView[]>;
  @Input({ required: true }) listGrantees!: () => Promise<GranteeView[]>;
  @Input({ required: true }) save!: SaveGrants;

  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);
  protected readonly selection = signal("");
  protected readonly dataSource = new TableDataSource<GrantView>();
  private readonly rows = signal<GrantView[]>([]);
  protected readonly grantees = signal<GranteeView[]>([]);
  protected readonly available = computed(() =>
    this.grantees()
      .filter((g) => !this.rows().some((r) => r.id === g.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  ngOnInit(): void {
    void this.refresh();
  }

  private sync(): void {
    this.dataSource.data = this.rows();
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const [grantees, grants] = await Promise.all([this.listGrantees(), this.load()]);
      this.grantees.set(grantees);
      const byId = new Map(grantees.map((g) => [g.id, g.name]));
      this.rows.set(grants.map((g) => ({ ...g, name: byId.get(g.id) ?? g.name ?? g.id })));
      this.sync();
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected select(event: Event): void {
    this.selection.set((event.target as HTMLSelectElement).value);
  }

  protected add(): void {
    const id = this.selection();
    const grantee = this.grantees().find((g) => g.id === id);
    if (grantee == null || this.rows().some((r) => r.id === id)) {
      return;
    }
    this.rows.update((rows) => [
      ...rows,
      {
        id,
        name: grantee.name,
        read: true,
        write: this.writeMode === "forced",
        currentUser: false,
      },
    ]);
    this.selection.set("");
    this.sync();
  }

  protected setPermission(id: string, value: string): void {
    const write = value === "rw";
    this.rows.update((rows) => rows.map((r) => (r.id === id ? { ...r, write } : r)));
    this.sync();
  }

  protected remove(id: string): void {
    this.rows.update((rows) => rows.filter((r) => r.id !== id));
    this.sync();
  }

  protected async submit(): Promise<void> {
    this.saving.set(true);
    try {
      await this.save(this.rows().map((r) => ({ id: r.id, read: r.read, write: r.write })));
      this.toastService.showToast({ variant: "success", message: this.savedMessage });
    } catch {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    } finally {
      this.saving.set(false);
    }
  }
}
