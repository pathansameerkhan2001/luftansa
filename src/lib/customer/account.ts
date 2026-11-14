import "server-only";

/**
 * Customer accounts & authentication policy:
 * Customer login and customer registration are NOT needed and not built.
 * Only administrator authentication (src/lib/auth) is supported.
 * No customer authentication flows, forms, or credentials exist.
 */

export interface CustomerProfile {
  name?: string;
  email: string;
  phone?: string;
}

export interface CustomerSession {
  customerId: string;
  profile: CustomerProfile;
}

export interface CustomerAccountStatus {
  /** Customer authentication is permanently disabled (admin auth only). */
  authConfigured: false;
  /** An order database / commerce backend is configured. */
  ordersConfigured: boolean;
}

export function getCustomerAccountStatus(): CustomerAccountStatus {
  return {
    authConfigured: false,
    ordersConfigured: Boolean(process.env.ORDERS_BACKEND?.trim()),
  };
}

/**
 * The signed-in customer, or null. Returns null until customer authentication
 * is implemented: there is no customer login yet, so nobody is signed in.
 */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  return null;
}
