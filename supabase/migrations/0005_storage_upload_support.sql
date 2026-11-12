-- SARAD storage compatibility patch.
-- Keep existing bucket IDs and policies; only widen supported upload formats.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'image/png','image/jpeg','image/webp','image/gif',
      'video/mp4','video/quicktime','video/webm',
      'audio/mpeg','audio/mp4','audio/wav',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/rtf','text/rtf','text/plain',
      'application/epub+zip'
    ]
where id = 'media';

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/rtf','text/rtf','text/plain',
      'application/epub+zip',
      'image/png','image/jpeg','image/webp'
    ]
where id = 'documents';

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/png','image/jpeg','image/webp']
where id in ('avatars','covers');

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/png','image/jpeg','image/webp','video/mp4','video/quicktime','video/webm']
where id = 'stories';
