import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { map } from "rxjs";

/** Shell for the Secrets Manager: a tab bar over the per-organization screens. */
@Component({
  selector: "sm-layout",
  standalone: true,
  templateUrl: "./sm-layout.component.html",
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmLayoutComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly organizationId$ = this.route.params.pipe(
    map((p) => p.organizationId as string),
  );

  // Tabs are added here as each screen lands.
  protected readonly tabs: { path: string; label: string }[] = [
    { path: "projects", label: "Projects" },
    { path: "secrets", label: "Secrets" },
    { path: "machine-accounts", label: "Machine accounts" },
  ];
}
