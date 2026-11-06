/**
 * Canonical resolution of the Firestore path segment that holds a member's
 * private data.
 *
 * Every screen that reads or writes member-owned documents (My Auditions,
 * Scene Study, the audition wizard, the acting coach) resolves the path the
 * same way, so a member always reaches exactly their own records and nobody
 * else's.
 *
 * The segment is `{uid}_{FirstName}` — the same shape the application has
 * always used, so no stored document has to move.
 */

/** The subset of the Firebase user record the path depends on. */
export interface PathUser {
  uid: string;
  displayName?: string | null;
}

/**
 * Returns the member's private-data path segment, or null when there is no
 * signed-in member.
 *
 * @param user - The authenticated Firebase user (or null while auth loads).
 * @returns `{uid}_{FirstName}`, or null when there is no user.
 */
export function resolveUserPath(user: PathUser | null | undefined): string | null {
  if (!user) return null;

  const firstName = user.displayName
    ? user.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "")
    : "Actor";

  return `${user.uid}_${firstName}`;
}
