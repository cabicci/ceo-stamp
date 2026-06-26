import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const AUTH_SESSION_TIMEOUT_MS = 1_500;
const AUTH_VERIFY_TIMEOUT_MS = 4_500;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = globalThis.setTimeout(() => resolve(null), timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      () => {
        globalThis.clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const sessionResult = await withTimeout(
      supabase.auth.getSession(),
      AUTH_SESSION_TIMEOUT_MS,
    );
    const sessionUser = sessionResult?.data.session?.user;
    if (sessionUser) return { user: sessionUser };

    const userResult = await withTimeout(supabase.auth.getUser(), AUTH_VERIFY_TIMEOUT_MS);
    if (!userResult?.data.user || userResult.error) throw redirect({ to: "/auth" });
    return { user: userResult.data.user };
  },
  component: () => <Outlet />,
});
