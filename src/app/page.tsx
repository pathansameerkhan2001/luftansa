import { BenefitsStrip } from "@/components/benefits/BenefitsStrip";
import { BestSellers } from "@/components/bestsellers/BestSellers";
import { HomeCollections } from "@/components/collection/HomeCollections";
import { HeroSection } from "@/components/hero/HeroSection";
import { ExploreByNotes } from "@/components/notes/ExploreByNotes";
import { InstagramReels } from "@/components/reels/InstagramReels";
import { BrandStory } from "@/components/story/BrandStory";
import { FaqSection } from "@/components/faq/FaqSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <BenefitsStrip />
      <HomeCollections />
      <ExploreByNotes />
      <BestSellers />
      <InstagramReels />
      <BrandStory />
      <FaqSection />
    </main>
  );
}
