import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./client";
import { transcriptions } from "./schema";

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
