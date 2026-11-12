import { supabase, SUPABASE_KEY, SUPABASE_URL } from './supabase';

export type UploadResult = { url: string; path: string; mime: string };

function encodeStoragePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
}

/**
 * Uploads the actual file bytes to Supabase Storage (not multipart/form-data).
 * React Native's XHR is used to expose real upload progress.
 */
export async function uploadWithProgress(input: {
  bucket: string;
  uri: string;
  fileName?: string | null;
  mime: string;
  ownerId: string;
  onProgress?: (percent: number) => void;
  signal?: { aborted: boolean };
}): Promise<UploadResult> {
  if (!input.ownerId) throw new Error('You must be signed in to upload files.');
  const safe = (input.fileName ?? `upload-${Date.now()}`).replace(/[^\\w.\\-]+/g, '_');
  const path = `${input.ownerId}/${Date.now()}-${safe}`;
  const { data: sess, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  const token = sess.session?.access_token;
  if (!token) throw new Error('Your session has expired. Sign in again.');

  const response = await fetch(input.uri);
  if (!response.ok) throw new Error(`Could not read selected file (${response.status}).`);
  const blob = await response.blob();
  if (!blob || blob.size === 0) throw new Error('The selected file is empty or unavailable.');

  const endpoint = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(input.bucket)}/${encodeStoragePath(path)}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', SUPABASE_KEY);
    xhr.setRequestHeader('Content-Type', input.mime || blob.type || 'application/octet-stream');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', '3600');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) input.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Supabase Storage rejected the upload (${xhr.status}): ${xhr.responseText?.slice(0, 300) || 'Unknown storage error'}`));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading. Check your internet connection.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    if (input.signal?.aborted) { reject(new Error('Upload cancelled.')); return; }
    xhr.send(blob);
  });

  input.onProgress?.(100);
  if (input.bucket === 'documents') {
    const { data, error } = await supabase.storage.from(input.bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
    if (error) throw new Error(`File uploaded, but a secure link could not be created: ${error.message}`);
    return { url: data.signedUrl, path, mime: input.mime };
  }
  const { data } = supabase.storage.from(input.bucket).getPublicUrl(path);
  return { url: data.publicUrl, path, mime: input.mime };
}
