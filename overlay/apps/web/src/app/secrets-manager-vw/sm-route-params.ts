import { ActivatedRoute } from "@angular/router";

/**
 * Merge route params along the whole ancestor chain. A routed tab child does not inherit its
 * parent's params (the project/machine-account route carries a component), so collect them here.
 */
export function routeParams(route: ActivatedRoute): { organizationId: string; projectId: string; machineAccountId: string } {
  const merged = route.snapshot.pathFromRoot.reduce<Record<string, string>>(
    (acc, r) => ({ ...acc, ...r.params }),
    {},
  );
  return {
    organizationId: merged.organizationId ?? "",
    projectId: merged.projectId ?? "",
    machineAccountId: merged.machineAccountId ?? "",
  };
}
