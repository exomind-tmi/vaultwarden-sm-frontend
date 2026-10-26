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
  DialogService,
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
  person: { icon: "bwi-user", groupKey: "users", order: 0 },
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

/** i18n keys of the confirmation shown before the user removes their own access. */
export interface SelfRemovalWarning {
  titleKey: string;
  messageKey: string;
}

interface Row extends GrantView {
  kind: GranteeKind;
  key: string;
}

/**
 * Access editor for one object (a project, a machine account): all its grants in one list,
 * whatever the grantee kind. Every change applies at once — adding grantees (with the permission
 * chosen beside the picker), changing a row's permission, removing a row — by replacing the grants
 * of that kind, as the API is split by grantee kind. Changes are sent one after another, and a
 * failed one reloads what the server holds. `writeMode` "forced" means every grant is read + write
 * (people on a machine account), so there is no permission to choose.
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
  @Input() selfRemovalWarning?: SelfRemovalWarning;

  private readonly toastService = inject(ToastService);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly dataSource = new TableDataSource<Row>();
  protected readonly picked = signal<SelectItemView[]>([]);
  /** The permission new grantees get when added. */
  protected readonly addWrite = signal(false);
  private readonly rows = signal<Row[]>([]);
  private readonly grantees = signal<{ kind: GranteeKind; grantees: GranteeView[] }[]>([]);
  /** Changes are applied strictly in order, so a quick second change never races the first. */
  private queue: Promise<void> = Promise.resolve();
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
    const write = this.writeMode === "forced" || this.addWrite();
    const added: Row[] = this.grantees().flatMap(({ kind, grantees }) =>
      grantees
        .filter((g) => picked.has(rowKey(kind, g.id)))
        .map((g) => {
          const key = rowKey(kind, g.id);
          return { id: g.id, name: g.name, read: true, write, currentUser: false, kind, key };
        }),
    );
    this.setRows([...this.rows(), ...added]);
    this.picked.set([]);
    this.apply(new Set(added.map((r) => r.kind)));
  }

  protected setPermission(row: Row, write: boolean): void {
    this.setRows(this.rows().map((r) => (r.key === row.key ? { ...r, write } : r)));
    this.apply(new Set([row.kind]));
  }

  protected async remove(row: Row): Promise<void> {
    if (row.currentUser && this.selfRemovalWarning) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: this.selfRemovalWarning.titleKey },
        content: { key: this.selfRemovalWarning.messageKey },
        type: "warning",
        acceptButtonText: { key: "remove" },
      });
      if (!confirmed) {
        return;
      }
    }
    this.setRows(this.rows().filter((r) => r.key !== row.key));
    this.apply(new Set([row.kind]));
  }

  /** Replace the grants of the given kinds on the server, after any change still in flight. */
  private apply(kinds: Set<GranteeKind>): void {
    const sources = this.sources.filter((s) => kinds.has(s.kind));
    this.queue = this.queue.then(async () => {
      try {
        for (const source of sources) {
          await source.save(this.grants(source.kind));
        }
        this.toastService.showToast({ variant: "success", message: this.savedMessage });
      } catch {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("errorOccurred"),
        });
        await this.refresh(); // show what the server actually holds
      }
    });
  }

  private grants(kind: GranteeKind): GrantRequest[] {
    return this.rows()
      .filter((r) => r.kind === kind)
      .map(({ id, read, write }) => ({ id, read, write }));
  }
}

function rowKey(kind: GranteeKind, id: string): string {
  return `${kind}:${id}`;
}
