import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, Router, RouterModule } from "@angular/router";
import { filter } from "rxjs";

import { WebLayoutModule } from "@bitwarden/web-vault/app/layouts/web-layout.module";

/**
 * The Secrets Manager shell. It renders its own web-vault layout (so the Password Manager side nav
 * is replaced, not inherited): the SM navigation goes in the `sidebar` outlet, the section in the
 * primary outlet.
 *
 * The router reuses a page's components when only its parameters change — another organization in
 * the switcher, another project or machine account — and SM components take their ids from the
 * route once, when created. So the primary outlet is keyed by those ids and remounted whenever
 * one changes; switching tabs within a page changes no id and keeps the page.
 */
@Component({
  selector: "sm-layout",
  standalone: true,
  templateUrl: "./layout.component.html",
  imports: [CommonModule, RouterModule, WebLayoutModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly pageKey = signal(pageKey(this.route.snapshot));

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.pageKey.set(pageKey(this.route.snapshot)));
  }
}

/** The ids the current SM page is about, from the layout route down the primary outlet. */
function pageKey(layout: ActivatedRouteSnapshot): string {
  const ids: string[] = [];
  for (let r: ActivatedRouteSnapshot | undefined = layout; r; ) {
    ids.push(...Object.values(r.params));
    r = r.children.find((c) => c.outlet === "primary");
  }
  const org = layout.pathFromRoot.map((r) => r.params.organizationId).find(Boolean) ?? "";
  return [org, ...ids].join("/");
}
