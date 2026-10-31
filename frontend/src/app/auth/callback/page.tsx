
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing Google sign-in...");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setMessage("Google sign-in failed. No authentication token received.");
      return;
    }

    try {
      const payloadPart = token.split(".")[1];
      if (!payloadPart) throw new Error("Invalid token");

      const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(
        atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))
      );

      if (!payload.userId || (payload.exp && payload.exp * 1000 < Date.now())) {
        throw new Error("Invalid or expired token");
      }

      localStorage.setItem("reachinbox_token", token);
      localStorage.setItem("reachinbox_user_id", payload.userId);

      setMessage("Sign-in successful. Redirecting...");
      router.replace("/");
    } catch {
      localStorage.removeItem("reachinbox_token");
      localStorage.removeItem("reachinbox_user_id");
      setMessage("Invalid or expired login. Please try again.");
    }
  }, [searchParams, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center">
        <div className="mx-auto mb-4 h-7 w-7 animate-spin rounded-full border-2 border-neutral-600 border-t-white" />
        <h1 className="text-lg font-semibold">ReachInbox</h1>
        <p className="mt-2 text-sm text-neutral-400">{message}</p>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
          Completing sign-in...
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
