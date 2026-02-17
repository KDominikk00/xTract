"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";

export default function Header() {
  const router = useRouter();
  const { user } = useAuth();

  const handleLogin = () => router.push("/login");
  const handleSignup = () => router.push("/signup");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/logout");
  };

  return (
    <header className="bg-(--color-bg) text-(--color-fg) border-b border-gray-800 px-6 py-4 flex justify-between items-center">
      <Link href="/" className="text-4xl font-bold">
        <span className="text-blue-500">x</span>Tract
      </Link>

      <div className="flex space-x-4">
        {!user ? (
          <>
            <button onClick={handleLogin} className="px-4 py-2 rounded transition">
              <span className="hover:text-blue-500 cursor-pointer transition">Login</span>
            </button>
            <button
              onClick={handleSignup}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-700 rounded transition cursor-pointer"
            >
              Sign Up
            </button>
          </>
        ) : (
          <button
            onClick={handleLogout}
            className="px-4 py-2 hover:bg-red-700 text-white rounded transition-colors cursor-pointer shadow-sm"
          >
            Log Out
          </button>
        )}
      </div>
    </header>
  );
}