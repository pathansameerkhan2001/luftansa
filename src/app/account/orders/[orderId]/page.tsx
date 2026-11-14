import { notFound } from "next/navigation";
import { AccountShell, SignInRequired } from "@/components/account/AccountUI";
import { getCustomerSession } from "@/lib/customer/account";

export const dynamic = "force-dynamic";

/**
 * /account/orders/[orderId]: order details. Without a signed-in customer the
 * page never reveals whether an order exists; it only asks the visitor to sign in.
 */
export default async function OrderDetailsPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!/^[A-Za-z0-9-]{1,64}$/.test(orderId)) notFound();
  const session = await getCustomerSession();

  return (
    <AccountShell
      title="Order details"
      current="orders"
      crumbs={[{ label: "My Account", href: "/account" }, { label: "Orders", href: "/account/orders" }, { label: "Order details" }]}
    >
      {!session ? <SignInRequired what="your order details" /> : null}
    </AccountShell>
  );
}
