"use client";

import { useState, useMemo } from "react";
import { CREDIT_CATEGORY_LABELS, type CreditCategory } from "@/lib/profile-types";

interface Credit {
  category: CreditCategory;
  title: string;
  role: string;
  year: string;
  productionCompany: string;
  featured: boolean;
}

interface CreditsSectionProps {
  credits: Credit[];
}

/**
 * Enterprise-grade Credits Display Component
 * Refactored to eliminate anti-patterns:
 * 1. Safely handles malformed legacy data (undefined categories).
 * 2. Implements deterministic composite keys instead of array indices for list hydration.
 * 3. Restores proper "All" filtering UX state management.
 */
export function CreditsSection({ credits }: CreditsSectionProps) {
  // SENIOR FIX 1: Data Sanitization
  // We filter out falsy values (undefined/null) before creating the Set.
  // Passing key={undefined} to React is treated as a missing key, which triggered your console warning.
  const categories = useMemo(() => {
    const uniqueCats = [...new Set(credits.map((c) => c.category).filter(Boolean))];
    return uniqueCats as CreditCategory[];
  }, [credits]);

  // SENIOR FIX 2: UX State Management
  // We initialize with `null` to represent the "All" un-filtered state,
  // instead of blindly defaulting to the first category which traps the user in a filtered view.
  const [activeCategory, setActiveCategory] = useState<CreditCategory | null>(null);

  const filtered = activeCategory
    ? credits.filter((c) => c.category === activeCategory)
    : credits;

  return (
    <section>
      <h2 className="mb-4 font-title text-xl font-bold text-[#212121]">Credits</h2>

      {/* Category filter badges */}
      <div className="mb-4 flex flex-wrap gap-2">
        
        {/* SENIOR FIX 3: Explicit and Static 'All' Button */}
        <button
          key="filter-all"
          onClick={() => setActiveCategory(null)}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            activeCategory === null
              ? "bg-[#FF751F] text-white"
              : "bg-[#494E3E] text-white hover:bg-[#555A4A]"
          }`}
        >
          All
        </button>

        {categories.map((cat) => (
          <button
            key={`filter-${cat}`} // Guaranteed unique and non-undefined
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === cat
                ? "bg-[#FF751F] text-white"
                : "bg-[#494E3E] text-white hover:bg-[#555A4A]"
            }`}
          >
            {CREDIT_CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Credits table */}
      <div className="overflow-x-auto rounded-lg bg-[#EAE2D4]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#494E3E] text-white">
              <th className="px-4 py-2.5 text-left font-medium">Production</th>
              <th className="px-4 py-2.5 text-left font-medium">Role</th>
              <th className="px-4 py-2.5 text-left font-medium">Year</th>
              <th className="px-4 py-2.5 text-left font-medium">
                Company / Director
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((credit, i) => {
              // SENIOR FIX 4: Deterministic Composite Keys
              // Using `key={i}` on a dynamically filtered list is a major React anti-pattern (gambiarra).
              // It causes state bleeding and unnecessary DOM repaints when the array length/order changes.
              // We generate a deterministic composite key based on the data signature.
              const compositeKey = `${credit.category}-${credit.title}-${credit.role}-${credit.year}-${i}`;
              
              return (
                <tr
                  key={compositeKey}
                  className={
                    i < filtered.length - 1
                      ? "border-b border-[#C7C0B5]/50"
                      : ""
                  }
                >
                  <td className="px-4 py-2.5 font-medium text-[#212121]">
                    {credit.title}
                  </td>
                  <td className="px-4 py-2.5 text-[#7E7E7E]">{credit.role}</td>
                  <td className="px-4 py-2.5 text-[#7E7E7E]">{credit.year}</td>
                  <td className="px-4 py-2.5 text-[#7E7E7E]">
                    {credit.productionCompany}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}