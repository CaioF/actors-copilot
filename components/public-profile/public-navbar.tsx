import Link from "next/link";
import Image from "next/image";
import { HelpCircle, User } from "lucide-react";

export function PublicNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#3A4F5A]/30 bg-[#3A4F5A] px-6 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="The Actors Copilot" width={28} height={28} />
          <span className="font-title text-sm font-bold tracking-wide text-[#F5F0E8]">
            Actor Profile
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <button className="rounded-full p-1.5 text-[#F5F0E8]/70 transition-colors hover:text-[#F5F0E8]">
            <HelpCircle className="h-5 w-5" />
          </button>
          <button className="rounded-full p-1.5 text-[#F5F0E8]/70 transition-colors hover:text-[#F5F0E8]">
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
