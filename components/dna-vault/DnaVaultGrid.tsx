"use client";

import React, { useState, useMemo } from "react";
import AccordionCard from "./AccordionCard";
import AttributeRow from "./AttributeRow";
import TraitBadge from "./TraitBadge";
import { Search, Brain, ShieldAlert, HeartHandshake, Flame, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

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

const CATEGORY_CONFIG: Record<string, { title: string; icon: React.ReactNode }> = {
  "Core Traits & Persona": {
    title: "Core Traits & Persona",
    icon: <Brain className="h-4 w-4" />,
  },
  "Values, Motivations & Emotional Reservoirs": {
    title: "Values, Motivations & Emotional Reservoirs",
    icon: <Flame className="h-4 w-4" />,
  },
  "Communication & Vocal Dynamics": {
    title: "Communication & Vocal Dynamics",
    icon: <HeartHandshake className="h-4 w-4" />,
  },
  "Physicality & Instincts": {
    title: "Physicality & Instincts",
    icon: <ShieldAlert className="h-4 w-4" />,
  },
};

const CATEGORIES = Object.keys(CATEGORY_CONFIG);

export function DnaVaultGrid({ attributes }: DnaVaultGridProps) {
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategoryExpand = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Filter attributes by search query
  const filteredAttributes = useMemo(() => {
    if (!searchQuery.trim()) return attributes;
    const query = searchQuery.toLowerCase().trim();
    return attributes.filter((a) => {
      const matchName = a.name.toLowerCase().includes(query);
      const matchCategory = a.category.toLowerCase().includes(query);
      const matchTags = a.tags?.some((t) => t.toLowerCase().includes(query));
      const matchDesc = a.description?.toLowerCase().includes(query);
      return matchName || matchCategory || matchTags || matchDesc;
    });
  }, [attributes, searchQuery]);

  // Group attributes by category
  const byCategory = useMemo(() => {
    const map: Record<string, DnaAttribute[]> = {};
    for (const c of CATEGORIES) map[c] = [];
    for (const a of filteredAttributes) {
      const cat = CATEGORY_CONFIG[a.category] ? a.category : CATEGORIES[0];
      if (!map[cat]) map[cat] = [];
      map[cat].push(a);
    }
    return map;
  }, [filteredAttributes]);

  const visibleCategories = useMemo(() => {
    if (activeTab === "ALL") {
      return CATEGORIES.filter((c) => (byCategory[c] || []).length > 0);
    }
    return CATEGORIES.filter((c) => c === activeTab);
  }, [activeTab, byCategory]);

  const renderCategoryCard = (c: string) => {
    const list = byCategory[c] || [];
    if (list.length === 0) return null;

    const isExpanded = !!expandedCategories[c];
    const initialLimit = 8;
    const displayedItems = isExpanded ? list : list.slice(0, initialLimit);
    const hasMore = list.length > initialLimit;

    return (
      <AccordionCard
        key={c}
        title={CATEGORY_CONFIG[c].title}
        subtitle={`${list.length} traits extracted`}
        icon={CATEGORY_CONFIG[c].icon}
      >
        <div className="divide-y divide-border/40 pt-1">
          {displayedItems.map((attr) => (
            <div
              key={attr.id}
              className="py-3.5 flex items-center justify-between gap-4 transition-colors hover:bg-muted/20 px-2 rounded-xl"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="font-semibold text-sm text-foreground leading-snug break-words">
                  {attr.name}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {attr.tags && attr.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {attr.tags.map((t) => (
                        <TraitBadge key={t} label={t} />
                      ))}
                    </div>
                  )}
                  {attr.description && (
                    <span className="text-[11px] text-muted-foreground line-clamp-1">
                      {attr.description}
                    </span>
                  )}
                </div>
              </div>

              <AttributeRow strength={attr.strength} />
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="pt-3 border-t border-border/40 text-center">
            <button
              type="button"
              onClick={() => toggleCategoryExpand(c)}
              className="py-1.5 px-4 rounded-full text-xs font-semibold text-primary hover:bg-primary/10 inline-flex items-center gap-1.5 transition-colors"
            >
              <span>
                {isExpanded ? "Show Less" : `Show All ${list.length} Traits`}
              </span>
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}
      </AccordionCard>
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar: Search & Category Filter Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-card/60 border border-border/80 p-3.5 rounded-2xl shadow-sm backdrop-blur-sm">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`py-2 px-3.5 rounded-full text-xs font-semibold transition-all duration-200 shrink-0 ${
              activeTab === "ALL"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All Traits ({filteredAttributes.length})
          </button>

          {CATEGORIES.map((c) => {
            const count = (byCategory[c] || []).length;
            if (count === 0 && searchQuery) return null;

            return (
              <button
                key={c}
                onClick={() => setActiveTab(c)}
                className={`py-2 px-3.5 rounded-full text-xs font-semibold transition-all duration-200 shrink-0 flex items-center gap-1.5 ${
                  activeTab === c
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{CATEGORY_CONFIG[c].title.split("&")[0].trim()}</span>
                <span className="opacity-75 text-[11px]">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search traits, wounds, values..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-full text-xs bg-background/80 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all"
          />
        </div>
      </div>

      {/* Empty Search Result Fallback */}
      {filteredAttributes.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-2">
          <Sparkles className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="font-semibold text-sm text-foreground">No matching DNA traits found</p>
          <p className="text-xs text-muted-foreground">Try clearing your search query filter.</p>
          <button
            onClick={() => setSearchQuery("")}
            className="mt-2 text-xs text-primary underline font-medium"
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Category Card Render Helper */}
      {activeTab === "ALL" && !searchQuery ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-6">
            {renderCategoryCard(CATEGORIES[0])}
            {renderCategoryCard(CATEGORIES[2])}
          </div>
          <div className="space-y-6">
            {renderCategoryCard(CATEGORIES[1])}
            {renderCategoryCard(CATEGORIES[3])}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {visibleCategories.map((c) => renderCategoryCard(c))}
        </div>
      )}
    </div>
  );
}

export default DnaVaultGrid;
