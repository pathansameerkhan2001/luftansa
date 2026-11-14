import { AccountShell, ACCOUNT_SECTION_ICONS, ContactLinks, LockedPanel, SetupNotice } from "@/components/account/AccountUI";
import { getCustomerSession } from "@/lib/customer/account";

export const dynamic = "force-dynamic";

/** /account: customer order and support concierge overview. */
export default async function AccountPage() {
  const session = await getCustomerSession();

  if (session) {
    // Signed-in view: only real data from the customer session.
    const { profile } = session;
    return (
      <AccountShell title="My Account" current="overview" crumbs={[{ label: "My Account" }]}>
        <section aria-labelledby="profile-heading" className="rounded-[22px] border border-brand-gold/35 bg-white/70 p-6">
          <h2 id="profile-heading" className="font-serif text-[24px] font-semibold text-brand-black">
            Profile
          </h2>
          <dl className="mt-4 divide-y divide-brand-gold/20 text-[14px]">
            {([["Name", profile.name], ["Email", profile.email], ["Mobile", profile.phone]] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="text-brand-text/65">{k}</dt>
                <dd className="font-medium text-brand-black">{v ?? "Not provided"}</dd>
              </div>
            ))}
          </dl>
        </section>
      </AccountShell>
    );
  }

  const { profile, orders, details } = ACCOUNT_SECTION_ICONS;
  return (
    <AccountShell title="My Account" current="overview" crumbs={[{ label: "My Account" }]}>
      <SetupNotice />

      <h2 className="mt-12 font-serif text-[26px] leading-tight font-semibold text-brand-black sm:text-[30px]">Your account</h2>
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <LockedPanel Icon={profile} title="Profile" description="Your name, email address, mobile number and saved details." />
        <LockedPanel
          Icon={orders}
          title="Order history"
          description="A list of every order you place with Luftansa and its current status."
          action={{ label: "View orders", href: "/account/orders" }}
        />
        <LockedPanel Icon={details} title="Order details" description="Items, sizes, quantities, totals and delivery information for each order." />
      </div>

      <section aria-labelledby="help-heading" className="mt-12 rounded-[22px] border border-brand-gold/30 bg-brand-cream px-5 py-6 sm:px-7">
        <h2 id="help-heading" className="font-serif text-[22px] font-semibold text-brand-black">
          Need help with an order?
        </h2>
        <p className="mt-1.5 text-[14px] text-brand-text/80">Our team can help with orders and questions right away.</p>
        <ContactLinks />
      </section>
    </AccountShell>
  );
}
