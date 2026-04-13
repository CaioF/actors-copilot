import Image from "next/image";
import { Lock, Trash2, Shield } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="mt-12">
      {/* Privacy row */}
      <div className="flex items-center justify-center gap-4 py-4 text-xs text-[#656565]">
        <span className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" />
          NDA Safe
        </span>
        <span>|</span>
        <span className="flex items-center gap-1.5">
          <Trash2 className="h-3.5 w-3.5" />
          Delete Anytime
        </span>
        <span>|</span>
        <span className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          Private By Default
        </span>
      </div>

      {/* Branding bar */}
      <div className="bg-[#3A4F5A]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="The Actors Copilot" width={24} height={24} />
            <span className="font-title text-sm font-bold text-[#F5F0E8]">Actor Profile</span>
          </div>
          <div className="flex items-center gap-3 text-[#F5F0E8]/70">
            <button className="rounded-full p-1.5 transition-colors hover:text-[#F5F0E8]">
              <Shield className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
