import type { Metadata } from "next";
import { SectionListing } from "@/components/collection/SectionListing";
import { STORE_NAME } from "@/data/store";

// Refreshed on demand after admin writes (revalidateStorefront); hourly safety net.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Roll-On | ${STORE_NAME}`,
  description: "Luftansa fragrances in a travel-friendly 8 ml roll-on.",
};

export default function RollOnPage() {
  return <SectionListing section="roll-on" />;
}
