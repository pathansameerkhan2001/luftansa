import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/PageHeader";
import { ExploreByNotes } from "@/components/notes/ExploreByNotes";
import { STORE_NAME } from "@/data/store";

export const metadata: Metadata = {
  title: `Explore by Notes | ${STORE_NAME}`,
  description: "Find your perfect Luftansa fragrance by note: citrus, woody, floral or oud.",
};

/** Explore by Notes: the four note families (the homepage section, as a page with its own heading). */
export default function NotesPage() {
  return (
    <main className="bg-brand-cream">
      <div className="mx-auto max-w-[1600px] px-4 pt-6 pb-4 sm:px-8 sm:pt-8 sm:pb-6">
        <Breadcrumbs crumbs={[{ label: "Explore by Notes" }]} />
      </div>
      <ExploreByNotes headingLevel="h1" />
    </main>
  );
}
