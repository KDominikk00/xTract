"use client";

import { motion, easeOut } from "framer-motion";

export default function MarketPage() {
  return (
    <motion.main
      className="max-w-5xl mx-auto px-6 py-16 text-white"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: easeOut }}
    >
      <h1 className="text-4xl font-bold text-blue-500 mb-8 text-center md:text-left">
        Market Sector Overview
      </h1>

      <div className="bg-[#0e111a] rounded-xl border border-blue-500 shadow-md p-8 text-center text-gray-400">
        <p>Heatmap loading</p>
      </div>
    </motion.main>
  );
}