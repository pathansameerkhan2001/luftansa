import type { Metadata } from "next";
import { SectionListing } from "@/components/collection/SectionListing";
import { STORE_NAME } from "@/data/store";

// Refreshed on demand after admin writes (revalidateStorefront); hourly safety net.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Perfumes | ${STORE_NAME}`,
  description: "Luftansa eau de parfum sprays in 30 ml, 50 ml and 100 ml.",
};

export default function PerfumesPage() {
  return <SectionListing section="perfume" />;
}
