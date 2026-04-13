import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ProfileNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="font-title text-3xl font-bold text-[#2C3328]">
        Profile Not Found
      </h1>
      <p className="mt-3 max-w-md text-[#6B6B6B]">
        This actor profile doesn&apos;t exist or hasn&apos;t been published yet.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#494E3E] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#555A4A]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>
    </div>
  );
}
