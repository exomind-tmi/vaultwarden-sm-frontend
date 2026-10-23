import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import { WebLayoutModule } from "@bitwarden/web-vault/app/layouts/web-layout.module";

/**
 * The Secrets Manager shell. It renders its own web-vault layout (so the Password Manager side nav
 * is replaced, not inherited): the SM navigation goes in the `sidebar` outlet, the section in the
 * primary outlet.
 */
@Component({
  selector: "sm-layout",
  standalone: true,
  templateUrl: "./layout.component.html",
  imports: [CommonModule, RouterModule, WebLayoutModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutComponent {}
