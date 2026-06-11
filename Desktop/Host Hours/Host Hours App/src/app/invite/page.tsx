"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { acceptInvitation } from "@/lib/actions/team";

type State = "loading" | "unauthenticated" | "accepting" | "success" | "error";

export default function InvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setError("Invalid invitation link — no token provided.");
      return;
    }

    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setState("unauthenticated");
        return;
      }

      setState("accepting");
      const result = await acceptInvitation(token!);

      if (result.error) {
        setState("error");
        setError(result.error);
        return;
      }

      if (result.data?.ownerId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", result.data.ownerId)
          .single();
        setOwnerName(profile?.full_name ?? null);
      }

      setState("success");
    }

    check();
  }, [token]);

  const redirectPath = `/invite?token=${token}`;
  const loginHref = `/login?next=${encodeURIComponent(redirectPath)}`;
  const signupHref = `/signup?next=${encodeURIComponent(redirectPath)}`;

  return (
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center px-7">
      <div className="max-w-sm w-full">
        {state === "loading" && (
          <div className="flex justify-center">
            <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {state === "unauthenticated" && (
          <>
            <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-tangerine mb-3 block">
              Team invitation
            </span>
            <h1 className="font-serif text-[38px] font-normal leading-[1.05] tracking-[-1.5px] text-plum mb-2">
              You&rsquo;re invited.
            </h1>
            <p className="font-serif italic text-[15px] text-quill leading-relaxed mb-8">
              Sign in or create an account to accept this invitation and join the team.
            </p>

            <div className="flex flex-col gap-3">
              <Link
                href={loginHref}
                className="w-full flex items-center justify-center bg-plum text-cream hover:bg-plum-deep min-h-12 px-5.5 py-3.5 rounded-md font-medium text-[15px] transition-colors"
              >
                Sign in
              </Link>
              <Link
                href={signupHref}
                className="w-full flex items-center justify-center bg-transparent text-plum border border-plum hover:bg-plum hover:text-cream min-h-12 px-5.5 py-3.5 rounded-md font-medium text-[15px] transition-colors"
              >
                Create account
              </Link>
            </div>
          </>
        )}

        {state === "accepting" && (
          <div className="text-center">
            <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin inline-block mb-4" />
            <p className="font-serif text-[17px] text-quill">
              Accepting invitation&hellip;
            </p>
          </div>
        )}

        {state === "success" && (
          <>
            <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-tangerine mb-3 block">
              Welcome aboard
            </span>
            <h1 className="font-serif text-[38px] font-normal leading-[1.05] tracking-[-1.5px] text-plum mb-2">
              You&rsquo;re in.
            </h1>
            <p className="font-serif italic text-[15px] text-quill leading-relaxed mb-8">
              {ownerName
                ? `You've joined ${ownerName}'s team on Host Hours.`
                : "You've joined the team on Host Hours."}
            </p>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="w-full flex items-center justify-center bg-plum text-cream hover:bg-plum-deep min-h-12 px-5.5 py-3.5 rounded-md font-medium text-[15px] transition-colors"
            >
              Go to dashboard
            </button>
          </>
        )}

        {state === "error" && (
          <>
            <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-tangerine mb-3 block">
              Invitation
            </span>
            <h1 className="font-serif text-[38px] font-normal leading-[1.05] tracking-[-1.5px] text-plum mb-2">
              Something went wrong.
            </h1>
            <div className="mb-6 px-4 py-3 rounded-md bg-tangerine/10 border border-tangerine/30">
              <p className="text-[13px] text-tangerine">{error}</p>
            </div>
            <Link
              href="/login"
              className="w-full flex items-center justify-center bg-plum text-cream hover:bg-plum-deep min-h-12 px-5.5 py-3.5 rounded-md font-medium text-[15px] transition-colors"
            >
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
