import { PolicyPage, policyMetadata } from "@/components/policies/PolicyPage";

// Refreshed on publish (CMS cache tags); hourly safety net.
export const revalidate = 3600;

export const generateMetadata = () => policyMetadata("shipping");

export default function Page() {
  return <PolicyPage policy="shipping" />;
}
