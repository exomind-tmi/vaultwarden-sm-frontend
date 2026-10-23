import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

/**
 * A lightweight change bus. The shared "New" menu lives in the header, away from the list it should
 * refresh, so it announces a create here and each list subscribes to reload.
 */
@Injectable({ providedIn: "root" })
export class SmEventsService {
  readonly changed$ = new Subject<void>();

  notify(): void {
    this.changed$.next();
  }
}
