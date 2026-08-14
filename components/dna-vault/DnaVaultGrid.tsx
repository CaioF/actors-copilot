"use client"

import React from "react";
import AccordionCard from "./AccordionCard";
import AttributeRow from "./AttributeRow";
import TraitBadge from "./TraitBadge";

export interface DnaAttribute {
  id: string;
  name: string;
  category: string;
  strength?: number;
  description?: string;
  tags?: string[];
}

interface DnaVaultGridProps {
  attributes: DnaAttribute[];
}

const CATEGORIES = [
  "Core Traits & Persona",
  "Communication & Vocal Dynamics",
  "Values, Motivations & Emotional Reservoirs",
  "Physicality & Instincts",
];

export function DnaVaultGrid({ attributes }: DnaVaultGridProps) {
  const byCategory: Record<string, DnaAttribute[]> = {};
  for (const c of CATEGORIES) byCategory[c] = [];
  for (const a of attributes) {
    const cat = a.category || CATEGORIES[0];
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(a);
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
      {CATEGORIES.map((c) => (
        <AccordionCard key={c} title={c} subtitle={`${byCategory[c]?.length || 0} traits`}>
          <div className="flex flex-wrap gap-2">
            {(byCategory[c] || []).map((attr) => (
              <div key={attr.id} className="w-full">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-card-foreground">{attr.name}</div>
                    {attr.tags && attr.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {attr.tags.map((t) => (
                          <TraitBadge key={t} label={t} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="ml-4 w-36">
                    <AttributeRow name={attr.name} strength={attr.strength} description={attr.description} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AccordionCard>
      ))}
    </div>
  );
}

export default DnaVaultGrid;
