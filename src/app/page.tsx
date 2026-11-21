import { HomeBenefits } from "@/components/benefits/HomeBenefits";
import { BestSellers } from "@/components/bestsellers/BestSellers";
import { HomeCollections } from "@/components/collection/HomeCollections";
import { HeroSection } from "@/components/hero/HeroSection";
import { ExploreByNotes } from "@/components/notes/ExploreByNotes";
import { InstagramReels } from "@/components/reels/InstagramReels";
import { BrandStory } from "@/components/story/BrandStory";
import { FaqSection } from "@/components/faq/FaqSection";

/**
 * Catalogue sections read DynamoDB. The page is cached and refreshed on demand
 * when the admin changes a product (revalidateStorefront), with an hourly
 * time-based refresh as a safety net.
 */
export const revalidate = 3600;

export default function Home() {
  return (
    <main>
      <HeroSection />
      <HomeBenefits />
      <HomeCollections />
      <ExploreByNotes />
      <BestSellers />
      <InstagramReels />
      <BrandStory />
      <FaqSection />
    </main>
  );
}
