"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();

  const signupClick = () => {
    router.push("/signup");
  }

  const loginClick = () => {
    router.push("/login");
  }

  return (
    <header className="bg-(--color-bg) text-(--color-fg) border-b border-gray-800 px-6 py-4 flex justify-between items-center">
      <Link href="/" className="text-4xl font-bold">
        <span className="text-blue-500">x</span>
        Tract
      </Link>

      <div className="flex space-x-4">
        <button onClick={loginClick} className="px-4 py-2 rounded transition">
          <span className="hover:text-blue-500 cursor-pointer transition">Login</span>
        </button>
        <button onClick={signupClick} className="px-4 py-2 bg-blue-500 hover:bg-blue-700 rounded transition cursor-pointer">
          Sign Up
        </button>
      </div>
    </header>
  );
}