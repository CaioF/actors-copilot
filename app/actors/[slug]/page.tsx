import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getPublicProfile } from "@/lib/get-public-profile";
import { HeroSection } from "@/components/public-profile/hero-section";
import { PhotosSection } from "@/components/public-profile/photos-section";
import { DetailsSection } from "@/components/public-profile/details-section";
import { ShowreelsSection } from "@/components/public-profile/showreels-section";
import { AboutSection } from "@/components/public-profile/about-section";
import { CreditsSection } from "@/components/public-profile/credits-section";
import { TrainingSection } from "@/components/public-profile/training-section";
import { SkillsSection } from "@/components/public-profile/skills-section";
import { Download } from "lucide-react";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);

  if (!profile) {
    return { title: "Profile Not Found" };
  }

  return {
    title: `${profile.fullName} - Actor Profile | The Actors Copilot`,
    description:
      profile.bio?.slice(0, 160) ||
      `Actor profile for ${profile.fullName}`,
    openGraph: {
      title: `${profile.fullName} - Actor Profile`,
      description: profile.bio?.slice(0, 160),
      images: profile.headshot ? [{ url: profile.headshot }] : [],
      type: "profile",
    },
    alternates: {
      types: {
        "text/markdown": `/actors/${slug}/index.md`,
      },
    },
  };
}

export default async function ActorPublicPage({ params }: Props) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);

  if (!profile) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <HeroSection profile={profile} />

      <div className="mt-10 space-y-10">
        {profile.additionalPhotos.length > 0 && (
          <PhotosSection photos={profile.additionalPhotos} />
        )}

        <DetailsSection profile={profile} />

        {profile.showreels.length > 0 && (
          <ShowreelsSection showreels={profile.showreels} />
        )}

        {profile.bio && <AboutSection bio={profile.bio} />}

        {profile.credits.length > 0 && (
          <CreditsSection credits={profile.credits} />
        )}

        {profile.training.length > 0 && (
          <TrainingSection training={profile.training} />
        )}

        {profile.skillsAndAccents.length > 0 && (
          <SkillsSection skills={profile.skillsAndAccents} />
        )}

        {/* Bottom Download CV button */}
        {profile.cvUrl && (
          <div className="flex justify-center pt-4">
            <a
              href={profile.cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#FF751F] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#FF751F]/90"
            >
              <Download className="h-4 w-4" />
              Download CV (PDF)
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
