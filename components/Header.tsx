export default function Header() {
  return (
    <header className="bg-(--color-bg) text-(--color-fg) border-b border-gray-800 px-6 py-4 flex justify-between items-center">
      <div className="text-4xl font-bold">
        <span className="text-blue-500">x</span>
        Tract
      </div>

      <div className="flex space-x-4">
        <button className="px-4 py-2 rounded transition">
          <span className="hover:text-blue-500 cursor-pointer transition">Login</span>
        </button>
        <button className="px-4 py-2 bg-blue-500 hover:bg-blue-700 rounded transition cursor-pointer">
          Sign Up
        </button>
      </div>
    </header>
  );
}