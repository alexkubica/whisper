import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { transcriptions, waitlistSignups } from "./schema";

export async function listRecentTranscriptionsByUser(
  userId: string,
  limit = 20,
) {
  const db = getDb();

  return db.query.transcriptions.findMany({
    where: eq(transcriptions.userId, userId),
    orderBy: [desc(transcriptions.createdAt)],
    limit,
  });
}

export async function createTranscriptionHistoryItem(input: {
  userId: string;
  fileName: string;
  mimeType: string;
  size: number;
  model: string;
  storageBucket: string | null;
  storagePath: string | null;
  text: string;
}) {
  const db = getDb();

  const [row] = await db.insert(transcriptions).values(input).returning();

  return row;
}

export async function setTranscriptionArchivedState(
  id: string,
  userId: string,
  archived: boolean,
) {
  const db = getDb();

  const [row] = await db
    .update(transcriptions)
    .set({
      archivedAt: archived ? new Date() : null,
    })
    .where(and(eq(transcriptions.id, id), eq(transcriptions.userId, userId)))
    .returning();

  return row ?? null;
}

export async function deleteTranscriptionRecord(id: string, userId: string) {
  const db = getDb();

  const [row] = await db
    .delete(transcriptions)
    .where(and(eq(transcriptions.id, id), eq(transcriptions.userId, userId)))
    .returning();

  return row ?? null;
}

export async function getTranscriptionRecordById(id: string, userId: string) {
  const db = getDb();

  return (
    db.query.transcriptions.findFirst({
      where: and(eq(transcriptions.id, id), eq(transcriptions.userId, userId)),
    }) ?? null
  );
}

function normalizeWaitlistContact(contact: string) {
  const trimmed = contact.trim();
  const isEmailLike = trimmed.includes("@");

  return {
    contact: isEmailLike ? trimmed.toLowerCase() : trimmed,
    kind: isEmailLike ? "email" : "unknown",
  };
}

async function getWaitlistSignupColumns() {
  const db = getDb();
  const result = await db.execute(sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'waitlist_signups'
  `);

  return new Set(
    result.map((row) => {
      const value = row.column_name;
      return typeof value === "string" ? value : String(value);
    }),
  );
}

export async function createWaitlistSignup(contact: string) {
  const db = getDb();
  const normalized = normalizeWaitlistContact(contact);
  const columns = await getWaitlistSignupColumns();

  if (columns.has("contact")) {
    const [row] = await db
      .insert(waitlistSignups)
      .values({
        contact: normalized.contact,
        kind: columns.has("kind") ? normalized.kind : "unknown",
      })
      .onConflictDoNothing({
        target: waitlistSignups.contact,
      })
      .returning();

    return row ?? null;
  }

  const targetColumn = columns.has("email")
    ? "email"
    : columns.has("phone")
      ? "phone"
      : columns.has("value")
        ? "value"
        : null;

  if (!targetColumn) {
    throw new Error("waitlist_signups table does not have a supported contact column.");
  }

  await db.execute(sql`
    insert into "waitlist_signups" (${sql.raw(`"${targetColumn}"`)})
    values (${normalized.contact})
  `);

  return { contact: normalized.contact };
}
