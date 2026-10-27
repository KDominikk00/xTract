"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaGoogle } from "react-icons/fa";
import PageLayout from "@/components/PageLayout";
import { supabase } from "@/lib/supabaseClient";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/confirm-email`,
      },
    });

    if (error) {
      setError(error.message);
    } else if (data.user && data.user.identities?.length === 0) {
      // Supabase hides whether an email is registered; an empty identities list means it already is.
      setError("An account with this email already exists. Try logging in instead.");
    } else {
      try {
        // Lets the confirmation page offer "resend email" without asking for the address again.
        sessionStorage.setItem("xtract:pending-email", email);
      } catch {
        // Storage can be unavailable (private mode); resend is then simply not offered.
      }
      router.push("/confirm-email");
    }

    setLoading(false);
  };

  const handleSocialLogin = async (provider: "google") => {
    const { error } = await supabase.auth.signInWithOAuth({ provider });
    if (error) setError(error.message);
  };

  return (
    <PageLayout>
      <section className="flex min-h-[60vh] items-center justify-center bg-(--color-bg) px-4 py-10 text-white sm:px-6 sm:py-14">
        <div className="w-full max-w-md rounded-xl border border-blue-500 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] p-6 shadow-md transition-shadow hover:shadow-lg sm:p-8">
          <h2 className="text-3xl font-bold mb-6 text-blue-500 text-center">
            Create Account
          </h2>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg bg-[#141c2f] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg bg-[#141c2f] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              {loading ? "Signing up..." : "Sign Up"}
            </button>
          </form>
          
          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

          <div className="flex items-center my-6">
            <hr className="grow border-zinc-600" />
            <span className="mx-2 text-zinc-400 text-sm">or continue with</span>
            <hr className="grow border-zinc-600" />
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleSocialLogin("google")}
              className="w-full flex items-center justify-center gap-3 px-4 py-2 rounded-lg bg-[#ffffff1a] hover:bg-[#ffffff33] transition-colors cursor-pointer"
            >
              <FaGoogle className="w-5 h-5" />
              Continue with Google
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-500 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </section>
    </PageLayout>
  );
}
