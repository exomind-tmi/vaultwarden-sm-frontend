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

import { GranteeView, GrantRequest, GrantView } from "./access-policy.service";

/** What a grant points at; fixes the row icon, the picker group and the ordering in the list. */
export type GranteeKind = "person" | "machineAccount" | "project";

const KINDS: Record<GranteeKind, { icon: string; groupKey: string; order: number }> = {
  person: { icon: "bwi-user", groupKey: "people", order: 0 },
  machineAccount: { icon: "bwi-wrench", groupKey: "machineAccounts", order: 1 },
  project: { icon: "bwi-collection", groupKey: "projects", order: 2 },
};

/** One kind of grantee on the edited object: how to read, offer and replace its grants. */
export interface AccessSource {
  kind: GranteeKind;
  load: () => Promise<GrantView[]>;
  listGrantees: () => Promise<GranteeView[]>;
  save: (grants: GrantRequest[]) => Promise<void>;
}

export type AccessWriteMode = "choice" | "forced";

interface Row extends GrantView {
  kind: GranteeKind;
  key: string;
}

/**
 * Save-based access editor for one object (a project, a machine account): all its grants in one
 * list, whatever the grantee kind. A grantee is picked and added, its permission is chosen per row,
 * and Save replaces the grants of every kind that changed — one PUT per kind, as the API is split
 * by grantee kind. `writeMode` "forced" means every grant is read + write (people on a machine
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
  @Input({ required: true }) sources!: AccessSource[];
  @Input() writeMode: AccessWriteMode = "choice";

  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly kinds = KINDS;
  protected readonly rowKey = rowKey;
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);
  protected readonly selection = signal("");
  protected readonly dataSource = new TableDataSource<Row>();
  private readonly rows = signal<Row[]>([]);
  /** The grants as last loaded or saved, per kind, so Save only replaces what changed. */
  private saved = new Map<GranteeKind, string>();
  private readonly grantees = signal<{ kind: GranteeKind; grantees: GranteeView[] }[]>([]);
  /** Grantees not granted yet, grouped by kind for the picker. */
  protected readonly available = computed(() =>
    this.grantees().map(({ kind, grantees }) => ({
      kind,
      grantees: grantees
        .filter((g) => !this.rows().some((r) => r.key === rowKey(kind, g.id)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })),
  );
  protected readonly nothingToAdd = computed(() =>
    this.available().every((group) => group.grantees.length === 0),
  );

  ngOnInit(): void {
    void this.refresh();
  }

  private setRows(rows: Row[]): void {
    rows.sort((a, b) => KINDS[a.kind].order - KINDS[b.kind].order || a.name.localeCompare(b.name));
    this.rows.set(rows);
    this.dataSource.data = rows;
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const loaded = await Promise.all(
        this.sources.map(async (s) => {
          const [grantees, grants] = await Promise.all([s.listGrantees(), s.load()]);
          return { kind: s.kind, grantees, grants };
        }),
      );
      this.grantees.set(loaded.map(({ kind, grantees }) => ({ kind, grantees })));
      this.setRows(
        loaded.flatMap(({ kind, grantees, grants }) => {
          const names = new Map(grantees.map((g) => [g.id, g.name]));
          return grants.map((g) => ({
            ...g,
            name: names.get(g.id) || g.name || g.id,
            kind,
            key: rowKey(kind, g.id),
          }));
        }),
      );
      this.saved = new Map(this.sources.map((s) => [s.kind, this.snapshot(s.kind)]));
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  /** Table rows arrive untyped from the data source, so the icon lookup takes the kind explicitly. */
  protected iconOf(kind: GranteeKind): string {
    return KINDS[kind].icon;
  }

  protected select(event: Event): void {
    this.selection.set((event.target as HTMLSelectElement).value);
  }

  protected add(): void {
    const key = this.selection();
    for (const { kind, grantees } of this.available()) {
      const grantee = grantees.find((g) => rowKey(kind, g.id) === key);
      if (grantee) {
        const write = this.writeMode === "forced";
        this.setRows([
          ...this.rows(),
          { id: grantee.id, name: grantee.name, read: true, write, currentUser: false, kind, key },
        ]);
      }
    }
    this.selection.set("");
  }

  protected setPermission(key: string, value: string): void {
    const write = value === "rw";
    this.setRows(this.rows().map((r) => (r.key === key ? { ...r, write } : r)));
  }

  protected remove(key: string): void {
    this.setRows(this.rows().filter((r) => r.key !== key));
  }

  protected async submit(): Promise<void> {
    this.saving.set(true);
    try {
      for (const source of this.sources) {
        const current = this.snapshot(source.kind);
        if (current !== this.saved.get(source.kind)) {
          await source.save(this.grants(source.kind));
          this.saved.set(source.kind, current);
        }
      }
      this.toastService.showToast({ variant: "success", message: this.savedMessage });
    } catch {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
      // One kind may have been saved before another failed: show what the server now holds.
      await this.refresh();
    } finally {
      this.saving.set(false);
    }
  }

  private grants(kind: GranteeKind): GrantRequest[] {
    return this.rows()
      .filter((r) => r.kind === kind)
      .map(({ id, read, write }) => ({ id, read, write }));
  }

  private snapshot(kind: GranteeKind): string {
    return JSON.stringify(this.grants(kind).sort((a, b) => a.id.localeCompare(b.id)));
  }
}

function rowKey(kind: GranteeKind, id: string): string {
  return `${kind}:${id}`;
}
