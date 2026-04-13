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

export function CreditsSection({ credits }: CreditsSectionProps) {
  // Get unique categories present in the credits
  const categories = useMemo(() => {
    const cats = [...new Set(credits.map((c) => c.category))];
    return cats;
  }, [credits]);

  const [activeCategory, setActiveCategory] = useState<CreditCategory | null>(
    categories[0] ?? null
  );

  const filtered = activeCategory
    ? credits.filter((c) => c.category === activeCategory)
    : credits;

  return (
    <section>
      <h2 className="mb-4 font-title text-xl font-bold text-[#212121]">Credits</h2>

      {/* Category filter badges */}
      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === cat
                ? "bg-[#FF751F] text-white"
                : "bg-[#494E3E] text-white hover:bg-[#555A4A]"
            }`}
          >
            {CREDIT_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Credits table */}
      <div className="overflow-x-auto rounded-lg">
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
            {filtered.map((credit, i) => (
              <tr
                key={i}
                className={
                  i < filtered.length - 1
                    ? "border-b border-[#C7C0B5]/40"
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
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
