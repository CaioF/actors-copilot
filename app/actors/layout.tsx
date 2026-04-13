import { PublicNavbar } from "@/components/public-profile/public-navbar";
import { PublicFooter } from "@/components/public-profile/public-footer";

export default function ActorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F0E8DC]">
      <PublicNavbar />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
