import { BenefitsStrip } from "@/components/benefits/BenefitsStrip";
import { SignatureCollection } from "@/components/collection/SignatureCollection";
import { HeroSection } from "@/components/hero/HeroSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <SignatureCollection />
      <BenefitsStrip />
    </main>
  );
}
