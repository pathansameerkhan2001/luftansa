import "server-only";

/**
 * Customer accounts: deliberately SEPARATE from the administrator Cognito
 * login (src/lib/auth). This module never reads admin cookies, admin env vars
 * or admin permissions, and admin sessions never grant customer access.
 *
 * Status today: no customer identity provider and no order database are
 * configured, so every account page renders an honest setup state.
 *
 * To enable later (both must be configured):
 *  - Customer sign-in: a SEPARATE identity store from the admin portal, e.g. a
 *    dedicated Cognito user pool + app client for customers. Set
 *    CUSTOMER_AUTH_PROVIDER and that provider's own env vars, never ADMIN_EMAILS
 *    or the admin client.
 *  - Orders: an order database / commerce backend. Set ORDERS_BACKEND.
 * Then implement getCustomerSession() and the order queries below.
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
  /** A customer identity provider is configured. */
  authConfigured: boolean;
  /** An order database / commerce backend is configured. */
  ordersConfigured: boolean;
}

export function getCustomerAccountStatus(): CustomerAccountStatus {
  return {
    authConfigured: Boolean(process.env.CUSTOMER_AUTH_PROVIDER?.trim()),
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
