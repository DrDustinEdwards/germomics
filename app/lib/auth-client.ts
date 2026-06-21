// Browser-side Better Auth client. Same-origin (/api/auth), so no baseURL needed.
// Used by the admin login screen only — the public site never imports this.
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
export const { signIn, signOut, useSession } = authClient;
