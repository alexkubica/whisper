export const DEFAULT_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";

export function resolveTranscribeModel(value = process.env.OPENAI_TRANSCRIBE_MODEL) {
  return value?.trim() || DEFAULT_TRANSCRIBE_MODEL;
}
