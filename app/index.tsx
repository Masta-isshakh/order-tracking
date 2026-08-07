import { Redirect } from 'expo-router';

/**
 * Everyone lands on the public storefront. Staff are routed to their workspace
 * from the Track tab once their role is known — the storefront is deliberately
 * the front door for every role.
 */
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
