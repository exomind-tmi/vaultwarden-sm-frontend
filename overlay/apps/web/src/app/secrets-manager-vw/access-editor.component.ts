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
import { FormsModule } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  A11yTitleDirective,
  ButtonModule,
  FormFieldModule,
  IconButtonModule,
  MultiSelectModule,
  SelectItemView,
  SelectModule,
  TableDataSource,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { GranteeView, GrantRequest, GrantView } from "./access-policy.service";

/** What a grant points at; fixes the row icon, the picker group and the ordering in the list. */
export type GranteeKind = "person" | "machineAccount" | "project";

const KINDS: Record<GranteeKind, { icon: string; groupKey: string; order: number }> = {
  person: { icon: "bwi-user", groupKey: "smUserAccounts", order: 0 },
  machineAccount: { icon: "bwi-wrench", groupKey: "smComputerAccounts", order: 1 },
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
 * list, whatever the grantee kind. Grantees are picked and added, a permission is chosen per row,
 * and Save replaces the grants of every kind that changed — one PUT per kind, as the API is split
 * by grantee kind. `writeMode` "forced" means every grant is read + write (people on a machine
 * account), so the permission is fixed.
 */
@Component({
  selector: "sm-access-editor",
  standalone: true,
  templateUrl: "./access-editor.component.html",
  imports: [
    CommonModule,
    FormsModule,
    A11yTitleDirective,
    ButtonModule,
    FormFieldModule,
    IconButtonModule,
    MultiSelectModule,
    SelectModule,
    TableModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessEditorComponent implements OnInit {
  @Input({ required: true }) hint!: string;
  /** The picker's label and help text, naming the kinds it offers. */
  @Input({ required: true }) label!: string;
  @Input({ required: true }) selectHint!: string;
  @Input({ required: true }) emptyMessage!: string;
  @Input({ required: true }) savedMessage!: string;
  @Input({ required: true }) sources!: AccessSource[];
  @Input() writeMode: AccessWriteMode = "choice";

  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);
  protected readonly dataSource = new TableDataSource<Row>();
  protected readonly picked = signal<SelectItemView[]>([]);
  private readonly rows = signal<Row[]>([]);
  /** The grants as last loaded or saved, per kind, so Save only replaces what changed. */
  private saved = new Map<GranteeKind, string>();
  private readonly grantees = signal<{ kind: GranteeKind; grantees: GranteeView[] }[]>([]);
  /** Grantees not granted yet, for the picker; grouped by kind when there is more than one. */
  protected readonly available = computed<SelectItemView[]>(() =>
    this.grantees().flatMap(({ kind, grantees }) =>
      grantees
        .filter((g) => !this.rows().some((r) => r.key === rowKey(kind, g.id)))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((g) => ({
          id: rowKey(kind, g.id),
          listName: g.name,
          labelName: g.name,
          icon: KINDS[kind].icon,
          parentGrouping:
            this.sources.length > 1 ? this.i18nService.t(KINDS[kind].groupKey) : undefined,
        })),
    ),
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

  protected add(): void {
    const picked = new Set(this.picked().map((i) => i.id));
    const write = this.writeMode === "forced";
    const added = this.grantees().flatMap(({ kind, grantees }) =>
      grantees
        .filter((g) => picked.has(rowKey(kind, g.id)))
        .map((g) => {
          const key = rowKey(kind, g.id);
          return { id: g.id, name: g.name, read: true, write, currentUser: false, kind, key };
        }),
    );
    this.setRows([...this.rows(), ...added]);
    this.picked.set([]);
  }

  protected setPermission(key: string, write: boolean): void {
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
