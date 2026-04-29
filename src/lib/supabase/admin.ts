import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig, getSupabaseStorageBucket } from "./config";

export function createSupabaseAdminClient() {
  const config = getSupabaseAdminConfig();

  if (!config) {
    return null;
  }

  return createClient(config.url, config.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function ensureStorageBucketExists(bucket: string) {
  const client = createSupabaseAdminClient();

  if (!client) {
    return;
  }

  const { data, error } = await client.storage.getBucket(bucket);

  if (!error && data) {
    return;
  }

  const { error: createError } = await client.storage.createBucket(bucket, {
    public: false,
  });

  if (
    createError &&
    !createError.message.toLowerCase().includes("already exists")
  ) {
    throw new Error(
      `Supabase Storage bucket "${bucket}" is missing and could not be created: ${createError.message}`,
    );
  }
}

export function createRecordingObjectPath(userId: string, fileName: string) {
  return `${userId}/${Date.now()}-${crypto.randomUUID()}-${fileName.replace(/[^a-z0-9-_.]/gi, "_")}`;
}

export async function createSignedRecordingUpload(input: {
  userId: string;
  fileName: string;
}) {
  const client = createSupabaseAdminClient();

  if (!client) {
    return null;
  }

  const bucket = getSupabaseStorageBucket();
  await ensureStorageBucketExists(bucket);
  const path = createRecordingObjectPath(input.userId, input.fileName);

  let { data, error } = await client.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error?.message === "Bucket not found") {
    await ensureStorageBucketExists(bucket);

    ({ data, error } = await client.storage.from(bucket).createSignedUploadUrl(path));
  }

  if (error || !data) {
    throw new Error(
      `Failed to prepare direct upload in bucket "${bucket}": ${error?.message ?? "Unknown error."}`,
    );
  }

  return {
    bucket,
    path,
    signedUrl: data.signedUrl,
    token: data.token,
  };
}

export async function uploadRecording(input: {
  userId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const client = createSupabaseAdminClient();

  if (!client) {
    return null;
  }

  const bucket = getSupabaseStorageBucket();
  await ensureStorageBucketExists(bucket);
  const path = createRecordingObjectPath(input.userId, input.fileName);

  let { error } = await client.storage.from(bucket).upload(path, input.buffer, {
    contentType: input.mimeType,
    upsert: false,
  });

  if (error?.message === "Bucket not found") {
    await ensureStorageBucketExists(bucket);

    ({ error } = await client.storage.from(bucket).upload(path, input.buffer, {
      contentType: input.mimeType,
      upsert: false,
    }));
  }

  if (error) {
    throw new Error(
      `Failed to store uploaded recording in bucket "${bucket}": ${error.message}`,
    );
  }

  return { bucket, path };
}

export async function createSignedRecordingUrl(
  bucket: string | null,
  path: string | null,
) {
  const client = createSupabaseAdminClient();

  if (!client || !bucket || !path) {
    return null;
  }

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    return null;
  }

  return data.signedUrl;
}

export async function deleteRecordingObject(
  bucket: string | null,
  path: string | null,
) {
  const client = createSupabaseAdminClient();

  if (!client || !bucket || !path) {
    return;
  }

  await client.storage.from(bucket).remove([path]);
}
