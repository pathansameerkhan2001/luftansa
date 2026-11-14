import { BenefitsStrip } from "@/components/benefits/BenefitsStrip";
import { HomeCollections } from "@/components/collection/HomeCollections";
import { HeroSection } from "@/components/hero/HeroSection";
import { ExploreByNotes } from "@/components/notes/ExploreByNotes";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <BenefitsStrip />
      <HomeCollections />
      <ExploreByNotes />
    </main>
  );
}
