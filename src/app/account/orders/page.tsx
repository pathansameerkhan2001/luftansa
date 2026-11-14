import { AccountShell, SignInRequired } from "@/components/account/AccountUI";
import { getCustomerAccountStatus, getCustomerSession } from "@/lib/customer/account";

export const dynamic = "force-dynamic";

/** /account/orders: order history for the signed-in customer (no data is ever invented). */
export default async function OrdersPage() {
  const session = await getCustomerSession();
  const { ordersConfigured } = getCustomerAccountStatus();

  return (
    <AccountShell title="Order history" current="orders" crumbs={[{ label: "My Account", href: "/account" }, { label: "Orders" }]}>
      {!session ? (
        <SignInRequired what="your order history" />
      ) : !ordersConfigured ? (
        <p className="rounded-2xl border border-brand-gold/40 bg-brand-cream p-5 text-[14px] text-brand-text/85">
          Online order history is not available yet. Please contact us for updates on your orders.
        </p>
      ) : null}
    </AccountShell>
  );
}
