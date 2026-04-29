import { desc } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const transcriptions = pgTable(
  "transcriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    model: text("model").notNull(),
    storageBucket: text("storage_bucket"),
    storagePath: text("storage_path"),
    text: text("text").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("transcriptions_user_id_idx").on(table.userId),
    index("transcriptions_user_id_created_at_idx").on(
      table.userId,
      desc(table.createdAt),
    ),
  ],
);

export const waitlistSignups = pgTable(
  "waitlist_signups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contact: text("contact").notNull(),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("waitlist_signups_contact_idx").on(table.contact)],
);

export type TranscriptionRecord = typeof transcriptions.$inferSelect;
