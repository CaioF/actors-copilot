import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase.admin";
import { ActorProfile } from "@/lib/profile-types";
import { profileToMarkdown } from "@/lib/profile-to-markdown";
import { headers } from "next/headers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const snapshot = await db
    .collection("actorProfiles")
    .where("slug", "==", slug)
    .where("status", "==", "published")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return new NextResponse("# Profile Not Found\n\nThis actor profile does not exist or has not been published.", {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  const data = snapshot.docs[0].data();

  // Convert Firestore Timestamps
  if (data.lastUpdated && typeof data.lastUpdated.toDate === "function") {
    data.lastUpdated = data.lastUpdated.toDate().toISOString();
  }
  if (data.publishedAt && typeof data.publishedAt.toDate === "function") {
    data.publishedAt = data.publishedAt.toDate().toISOString();
  }

  const profile = data as ActorProfile & { lastUpdated?: string };

  // Derive base URL from request headers
  const headersList = await headers();
  const host = headersList.get("host") || "theactorscopilot.com";
  const proto = headersList.get("x-forwarded-proto") || "https";
  const baseUrl = `${proto}://${host}`;

  const markdown = profileToMarkdown(profile, baseUrl);

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
