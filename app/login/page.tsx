"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaGoogle, FaFacebookF } from "react-icons/fa";
import PageLayout from "@/components/PageLayout";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) setError(error.message);
    else router.push("/");

    setLoading(false);
  };

  const handleSocialLogin = async (provider: "google" | "facebook" | "apple") => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({ provider });

    if (error) setError(error.message);
    else router.push("/");

    setLoading(false);
  };

  return (
    <PageLayout>
      <main className="flex items-center justify-center px-6 bg-(--color-bg) text-white min-h-[calc(100vh-12rem)] sm:min-h-screen">
        <div className="w-full max-w-md border border-blue-500 rounded-xl shadow-md p-8 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] hover:shadow-lg transition-shadow">
          <h2 className="text-3xl font-bold mb-6 text-blue-500 text-center">Log In</h2>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm mb-1">Email</label>
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
              <label htmlFor="password" className="block text-sm mb-1">Password</label>
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
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>
          
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

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

            <button
              onClick={() => handleSocialLogin("facebook")}
              className="w-full flex items-center justify-center gap-3 px-4 py-2 rounded-lg bg-[#1877f2] hover:bg-[#155db2] transition-colors text-white cursor-pointer"
            >
              <FaFacebookF className="w-5 h-5" />
              Continue with Facebook
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-gray-400">
            Don’t have an account?{" "}
            <Link href="/signup" className="text-blue-500 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </PageLayout>
  );
}