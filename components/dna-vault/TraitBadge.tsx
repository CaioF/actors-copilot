import React from "react";

interface TraitBadgeProps {
  label: string;
  onClick?: () => void;
}

export function TraitBadge({ label, onClick }: TraitBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-primary/10 text-primary"
    >
      {label}
    </button>
  );
}

export default TraitBadge;
