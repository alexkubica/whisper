import type { TranscriptionRecord } from "@/db/schema";

export type HistoryItem = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  model: string;
  isArchived: boolean;
  isRtl: boolean;
  recordingUrl: string | null;
  text: string;
  createdAt: string;
};

function isPredominantlyRtl(text: string) {
  const rtlMatches = text.match(/[\u0590-\u08FF]/g) ?? [];
  const ltrMatches = text.match(/[A-Za-z]/g) ?? [];

  return rtlMatches.length > 0 && rtlMatches.length >= ltrMatches.length;
}

export function serializeHistoryItem(
  record: TranscriptionRecord,
  recordingUrl: string | null = null,
): HistoryItem {
  return {
    id: record.id,
    fileName: record.fileName,
    mimeType: record.mimeType,
    size: record.size,
    model: record.model,
    isArchived: Boolean(record.archivedAt),
    isRtl: isPredominantlyRtl(record.text),
    recordingUrl,
    text: record.text,
    createdAt: record.createdAt.toISOString(),
  };
}
