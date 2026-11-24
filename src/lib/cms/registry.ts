/**
 * Registered CMS modules. Each Phase 3B page registers its module here as it
 * is built. The generic admin API answers 404 for any module not listed, and
 * the Media Library's "where used" check scans every module listed here.
 */
import { ANNOUNCEMENT_MODULE } from "./modules/announcement-bar";
import { BRAND_STORY_MODULE } from "./modules/brand-story";
import { HERO_MODULE } from "./modules/hero";
import { HOME_COLLECTIONS_MODULE } from "./modules/home-collections";
import { OUR_STORY_MODULE } from "./modules/our-story";
import { POLICY_MODULES } from "./modules/policy-pages";
import { REELS_MODULE, REELS_SECTION_MODULE } from "./modules/reels";
import { TRUST_TAGS_MODULE } from "./modules/trust-tags";
import type { CmsModuleDefinition } from "./schemas";

export const CMS_MODULES: readonly CmsModuleDefinition[] = [HERO_MODULE, ANNOUNCEMENT_MODULE, REELS_SECTION_MODULE, REELS_MODULE, BRAND_STORY_MODULE, HOME_COLLECTIONS_MODULE, TRUST_TAGS_MODULE, OUR_STORY_MODULE, ...Object.values(POLICY_MODULES)];

export function getCmsModule(id: string, modules: readonly CmsModuleDefinition[] = CMS_MODULES): CmsModuleDefinition | undefined {
  return modules.find((m) => m.id === id);
}

export const cmsTag = (moduleId: string) => `cms:${moduleId}`;
/**
 * Second tag on the same content, used only by the follow-up revalidation
 * (src/lib/cms/loader.ts). It must differ from cmsTag: Next.js ignores a
 * revalidation of a tag that is already pending in the same request, which
 * includes work scheduled with `after`.
 */
export const cmsFollowUpTag = (moduleId: string) => `cms:${moduleId}:follow-up`;
