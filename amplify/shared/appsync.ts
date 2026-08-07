/**
 * Shape of the event Amplify's generated resolver sends to a Lambda-backed
 * custom operation.
 *
 * It is NOT the standard `AppSyncResolverEvent`: the generated VTL builds the
 * payload by hand as
 *
 *   { typeName, fieldName, arguments, identity, source, request, prev }
 *
 * so `event.info` does not exist and `event.fieldName` is where the operation
 * name lives. Reading `event.info.fieldName` throws at runtime.
 */
export type AmplifyResolverEvent = {
  typeName: string;
  fieldName: string;
  arguments: Record<string, unknown>;
  identity?: {
    sub?: string;
    username?: string;
    claims?: Record<string, unknown>;
    groups?: string[] | null;
    sourceIp?: string[];
  } | null;
  source?: Record<string, unknown> | null;
  request?: { headers?: Record<string, string> } | null;
  prev?: { result?: Record<string, unknown> } | null;
};

/** Reads the operation name, tolerating either payload shape. */
export const resolverFieldName = (event: AmplifyResolverEvent): string =>
  event.fieldName ?? (event as { info?: { fieldName?: string } }).info?.fieldName ?? '';

/** Best-effort display name for the caller, used for audit fields. */
export const callerName = (event: AmplifyResolverEvent, fallback: string): string => {
  const claims = (event.identity?.claims ?? {}) as Record<string, unknown>;
  return (
    (typeof claims.name === 'string' && claims.name) ||
    (typeof claims.phone_number === 'string' && claims.phone_number) ||
    fallback
  );
};

export const callerSub = (event: AmplifyResolverEvent): string | null =>
  event.identity?.sub ??
  (typeof event.identity?.claims?.sub === 'string' ? event.identity.claims.sub : null);
