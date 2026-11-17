/**
 * Registered CMS modules. Phase 3A ships the foundation only; modules
 * (announcement bar, hero, homepage sections, …) are registered from Phase 3B.
 * The generic admin API answers 404 for any module not listed here.
 */
import type { CmsModuleDefinition } from "./schemas";

export const CMS_MODULES: readonly CmsModuleDefinition[] = [];

export function getCmsModule(id: string, modules: readonly CmsModuleDefinition[] = CMS_MODULES): CmsModuleDefinition | undefined {
  return modules.find((m) => m.id === id);
}

export const cmsTag = (moduleId: string) => `cms:${moduleId}`;
