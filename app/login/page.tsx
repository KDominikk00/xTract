"use client";

import { useState } from "react";
import Link from "next/link";
import { FaGoogle, FaFacebookF, FaApple } from "react-icons/fa";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    // TODO: Connect login logic
    console.log({ email, password });
    setLoading(false);
  };

  const handleSocialLogin = (provider: string) => {
    // TODO: Connect social login logic (Google, Facebook, etc.)
    console.log(`Login with ${provider}`);
  };

  return (
    <main className="flex items-center justify-center px-6 bg-(--color-bg) text-white min-h-screen">
      <div className="w-full max-w-md border border-blue-500 rounded-xl shadow-md p-8 bg-gradient-to-br from-[#0e111a] to-[#1a1f2a] hover:shadow-lg transition-shadow">
        <h2 className="text-3xl font-bold mb-6 text-blue-500 text-center">
          Log In
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
            className="w-full py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-colors"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <div className="flex items-center my-6">
          <hr className="flex-grow border-zinc-600" />
          <span className="mx-2 text-zinc-400 text-sm">or continue with</span>
          <hr className="flex-grow border-zinc-600" />
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleSocialLogin("Google")}
            className="w-full flex items-center justify-center gap-3 px-4 py-2 rounded-lg bg-[#ffffff1a] hover:bg-[#ffffff33] transition-colors"
          >
            <FaGoogle className="w-5 h-5" />
            Continue with Google
          </button>

          <button
            onClick={() => handleSocialLogin("Facebook")}
            className="w-full flex items-center justify-center gap-3 px-4 py-2 rounded-lg bg-[#1877f2] hover:bg-[#155db2] transition-colors text-white"
          >
            <FaFacebookF className="w-5 h-5" />
            Continue with Facebook
          </button>

          <button
            onClick={() => handleSocialLogin("Apple")}
            className="w-full flex items-center justify-center gap-3 px-4 py-2 rounded-lg bg-black hover:bg-[#333333] transition-colors text-white"
          >
            <FaApple className="w-5 h-5" />
            Continue with Apple
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
  );
}