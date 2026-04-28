export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function hasSupabaseAuth() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function hasSupabaseStorageAdmin() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
  );
}
