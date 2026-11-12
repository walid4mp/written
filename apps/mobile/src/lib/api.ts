import { supabase } from './supabase';

export type Work = {
  id: string;
  title: string;
  synopsis: string | null;
  cover_url: string | null;
  kind: string;
  language: string;
  genres: string[];
  tags: string[];
  status: string;
  chapters_count: number;
  reads_count: number;
  likes_count: number;
  rating_avg: number;
  rating_count: number;
  is_premium: boolean;
  price: number;
  author_id: string;
  published_at: string | null;
  author?: { username: string; display_name: string; is_verified: boolean; avatar_url: string | null } | null;
};

const WORK_SELECT =
  'id,title,synopsis,cover_url,kind,language,genres,tags,status,chapters_count,reads_count,likes_count,rating_avg,rating_count,is_premium,price,author_id,published_at,' +
  'author:profiles!works_author_id_fkey(username,display_name,is_verified,avatar_url)';

export async function listWorks(opts: { q?: string; kind?: string; lang?: string; limit?: number } = {}) {
  let query = supabase
    .from('works')
    .select(WORK_SELECT)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(opts.limit ?? 30);

  if (opts.kind && opts.kind !== 'all') query = query.eq('kind', opts.kind as never);
  if (opts.lang) query = query.eq('language', opts.lang as never);
  if (opts.q && opts.q.trim()) query = query.textSearch('search_doc', opts.q.trim(), { type: 'websearch' });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Work[];
}

export async function getWork(id: string) {
  const { data, error } = await supabase.from('works').select(WORK_SELECT).eq('id', id).single();
  if (error) throw new Error(error.message);
  return data as unknown as Work;
}

export async function getChapters(workId: string) {
  const { data, error } = await supabase
    .from('chapters')
    .select('id,title,chapter_number,words_count,is_premium,content,published_at')
    .eq('work_id', workId)
    .eq('status', 'published')
    .order('chapter_number');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getMyProgress(workId: string, userId: string) {
  const { data } = await supabase
    .from('reading_progress')
    .select('chapter_id,percent,scroll_pos')
    .eq('work_id', workId)
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function saveProgress(input: {
  userId: string;
  workId: string;
  chapterId: string | null;
  percent: number;
}) {
  await supabase.from('reading_progress').upsert(
    {
      user_id: input.userId,
      work_id: input.workId,
      chapter_id: input.chapterId,
      percent: Math.max(0, Math.min(100, input.percent)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,work_id' },
  );
}

export async function registerRead(workId: string, chapterId: string | null) {
  await supabase.rpc('register_read', { p_work: workId, p_chapter: chapterId });
}

export async function toggleLibrary(workId: string, userId: string, collection = 'saved') {
  const { data } = await supabase
    .from('library_items')
    .select('work_id')
    .eq('work_id', workId)
    .eq('user_id', userId)
    .eq('collection', collection)
    .maybeSingle();
  if (data) {
    await supabase.from('library_items').delete().eq('work_id', workId).eq('user_id', userId).eq('collection', collection);
    return false;
  }
  await supabase.from('library_items').insert({ work_id: workId, user_id: userId, collection });
  return true;
}

export async function isInLibrary(workId: string, userId: string) {
  const { data } = await supabase
    .from('library_items')
    .select('work_id')
    .eq('work_id', workId)
    .eq('user_id', userId)
    .eq('collection', 'saved')
    .maybeSingle();
  return !!data;
}

export async function myLibrary(userId: string) {
  const { data, error } = await supabase
    .from('library_items')
    .select(`collection,created_at,work:works(${WORK_SELECT})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as { collection: string; created_at: string; work: Work }[];
}

export async function myWorks(userId: string) {
  const { data, error } = await supabase
    .from('works')
    .select('id,title,status,kind,chapters_count,reads_count,likes_count,updated_at,cover_url')
    .eq('author_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function toggleFollow(targetId: string, userId: string) {
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
    .eq('following_id', targetId)
    .maybeSingle();
  if (data) {
    await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', targetId);
    return false;
  }
  await supabase.from('follows').insert({ follower_id: userId, following_id: targetId });
  return true;
}

export async function toggleLike(targetType: 'post' | 'work' | 'chapter' | 'comment', targetId: string, userId: string) {
  const { data } = await supabase
    .from('likes')
    .select('target_id')
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle();
  if (data) {
    await supabase.from('likes').delete().eq('user_id', userId).eq('target_type', targetType).eq('target_id', targetId);
    return false;
  }
  await supabase.from('likes').insert({ user_id: userId, target_type: targetType, target_id: targetId });
  return true;
}

export async function listComments(targetType: string, targetId: string) {
  const { data, error } = await supabase
    .from('comments')
    .select('id,body,created_at,likes_count,replies_count,author_id,parent_id,author:profiles!comments_author_id_fkey(username,display_name,avatar_url,is_verified)')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addComment(input: {
  authorId: string;
  targetType: string;
  targetId: string;
  body: string;
  parentId?: string | null;
}) {
  const { error } = await supabase.from('comments').insert({
    author_id: input.authorId,
    target_type: input.targetType,
    target_id: input.targetId,
    body: input.body,
    parent_id: input.parentId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function rateWork(workId: string, userId: string, score: number, review?: string) {
  const { error } = await supabase
    .from('ratings')
    .upsert({ work_id: workId, user_id: userId, score, review: review ?? null }, { onConflict: 'user_id,work_id' });
  if (error) throw new Error(error.message);
}

export async function canPublish() {
  const { data, error } = await supabase.rpc('can_publish');
  if (error) throw new Error(error.message);
  return data as {
    allowed: boolean;
    reason: string;
    price?: number;
    currency?: string;
    used?: number;
    limit?: number;
  };
}

export async function createWork(input: {
  authorId: string;
  title: string;
  synopsis?: string;
  kind: string;
  language: string;
  genres?: string[];
  tags?: string[];
  cover_url?: string | null;
}) {
  const { data, error } = await supabase
    .from('works')
    .insert({
      author_id: input.authorId,
      title: input.title,
      synopsis: input.synopsis ?? null,
      kind: input.kind,
      language: input.language,
      genres: input.genres ?? [],
      tags: input.tags ?? [],
      cover_url: input.cover_url ?? null,
      status: 'draft',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateWork(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('works').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function publishWork(id: string) {
  const { error } = await supabase.from('works').update({ status: 'published' }).eq('id', id);
  if (error) throw new Error(error.message);
  const { data } = await supabase.from('works').select('status,rejection_reason').eq('id', id).single();
  return data;
}

export async function listChaptersForEdit(workId: string) {
  const { data, error } = await supabase
    .from('chapters')
    .select('id,title,content,chapter_number,status,words_count')
    .eq('work_id', workId)
    .order('chapter_number');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertChapter(input: {
  id?: string;
  workId: string;
  title: string;
  content: string;
  number: number;
  publish?: boolean;
}) {
  const words = input.content.trim() ? input.content.trim().split(/\s+/).length : 0;
  const payload = {
    work_id: input.workId,
    title: input.title,
    content: input.content,
    chapter_number: input.number,
    words_count: words,
    status: input.publish ? 'published' : 'draft',
    published_at: input.publish ? new Date().toISOString() : null,
  };
  if (input.id) {
    const { error } = await supabase.from('chapters').update(payload).eq('id', input.id);
    if (error) throw new Error(error.message);
    return input.id;
  }
  const { data, error } = await supabase.from('chapters').insert(payload).select('id').single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function listNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,kind,title,body,read_at,created_at,data,target_type,target_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function markAllRead(userId: string) {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
}

export async function myConversations(userId: string) {
  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id,last_read_at,is_muted,conversation:conversations(id,kind,title,avatar_url,last_message_at)')
    .eq('user_id', userId)
    .order('conversation(last_message_at)', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function conversationMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('id,body,kind,media_url,file_name,created_at,sender_id,edited_at,deleted_at')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body,
    kind: 'text',
  });
  if (error) throw new Error(error.message);
}

export async function ensureDirectConversation(meId: string, otherId: string) {
  const { data: mine } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', meId);
  const ids = (mine ?? []).map((m) => m.conversation_id);
  if (ids.length) {
    const { data: both } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', otherId)
      .in('conversation_id', ids);
    if (both && both.length) return both[0].conversation_id as string;
  }
  const { data: conv, error } = await supabase
    .from('conversations')
    .insert({ kind: 'direct', created_by: meId })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await supabase.from('conversation_members').insert([
    { conversation_id: conv.id, user_id: meId, role: 'admin' },
    { conversation_id: conv.id, user_id: otherId },
  ]);
  return conv.id as string;
}

export async function activeStories() {
  const { data, error } = await supabase
    .from('stories')
    .select('id,author_id,media_url,media_kind,caption,bg_color,created_at,expires_at,author:profiles!stories_author_id_fkey(username,display_name,avatar_url)')
    .eq('is_archived', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function viewStory(storyId: string, viewerId: string) {
  await supabase.from('story_views').insert({ story_id: storyId, viewer_id: viewerId }).select();
}

export async function myGroups(userId: string) {
  const { data, error } = await supabase
    .from('group_members')
    .select('status,role,group:groups(id,name,slug,description,cover_url,privacy,members_count)')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function publicGroups(q?: string) {
  let query = supabase
    .from('groups')
    .select('id,name,slug,description,cover_url,privacy,members_count,category')
    .order('members_count', { ascending: false })
    .limit(40);
  if (q) query = query.ilike('name', `%${q}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function joinGroup(groupId: string, userId: string) {
  const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: userId, status: 'pending' });
  if (error) throw new Error(error.message);
}

export async function subscriptionState(userId: string) {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id,status,current_period_end,cancel_at_period_end,plan:plans(code,name_en,name_ar,name_fr,price,currency,interval)')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: ex } = await supabase
    .from('exemptions')
    .select('id,kind,expires_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('revoked_at', null);

  const { data: plans } = await supabase.from('plans').select('*').eq('is_active', true).order('sort_order');
  return { sub, exemptions: ex ?? [], plans: plans ?? [] };
}

export async function myPayments(userId: string) {
  const { data } = await supabase
    .from('payments')
    .select('id,amount,currency,status,purpose,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function listFounders() {
  const { data, error } = await supabase.from('founders').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function submitVerification(input: {
  userId: string;
  badge: string;
  legalName?: string;
  portfolioUrl?: string;
  note?: string;
}) {
  const { error } = await supabase.from('verification_requests').insert({
    user_id: input.userId,
    requested_badge: input.badge,
    legal_name: input.legalName ?? null,
    portfolio_url: input.portfolioUrl ?? null,
    note: input.note ?? null,
    status: 'pending',
  });
  if (error) throw new Error(error.message);
}

export async function requestAccountType(userId: string, currentType: string, requestedType: string, motivation: string) {
  const { error } = await supabase.from('account_type_requests').insert({
    user_id: userId,
    current_type: currentType as never,
    requested_type: requestedType as never,
    motivation,
    status: 'pending',
  });
  if (error) throw new Error(error.message);
}

export async function reportContent(input: {
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  details?: string;
}) {
  const { error } = await supabase.from('reports').insert({
    reporter_id: input.reporterId,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: input.details ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateProfile(userId: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) throw new Error(error.message);
}

/* ─────────────────────────  posts / media / reels  ───────────────────────── */

export type Post = {
  id: string;
  body: string | null;
  visibility: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  author_id: string;
  work_id: string | null;
  author?: { username: string; display_name: string; avatar_url: string | null; is_verified: boolean } | null;
  media?: { id: string; url: string; kind: string; mime: string | null }[];
};

const POST_SELECT =
  'id,body,visibility,created_at,likes_count,comments_count,author_id,work_id,' +
  'author:profiles!posts_author_id_fkey(username,display_name,avatar_url,is_verified),' +
  'media(id,url,kind,mime)';

export async function listFeed(limit = 30) {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Post[];
}

/** Everything a profile must show: posts of that user (public + own). */
export async function listUserPosts(userId: string, limit = 40) {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('author_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Post[];
}

export async function createPost(input: { authorId: string; body: string; visibility?: string }) {
  const { data, error } = await supabase
    .from('posts')
    .insert({ author_id: input.authorId, body: input.body, visibility: input.visibility ?? 'public' })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function deletePost(id: string) {
  const { error } = await supabase.from('posts').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export type UploadKind = 'image' | 'video' | 'audio' | 'file';

/**
 * Uploads real bytes to Supabase Storage and returns the public URL.
 * Bucket policies (0001_init.sql + 0004) restrict writes to <uid>/ prefixes.
 */
export async function uploadMedia(input: {
  bucket?: string;
  localUri: string;
  fileName?: string | null;
  mime?: string | null;
  kind: UploadKind;
  ownerId: string;
}): Promise<{ url: string; path: string; kind: UploadKind; mime: string }> {
  const bucket = input.bucket ?? 'media';
  const safe = (input.fileName ?? `upload-${Date.now()}`).replace(/[^\w.\-]+/g, '_');
  const path = `${input.ownerId}/${Date.now()}-${safe}`;
  const res = await fetch(input.localUri);
  const buf = await res.arrayBuffer();
  const mime = input.mime ?? (input.kind === 'video' ? 'video/mp4' : input.kind === 'image' ? 'image/jpeg' : 'application/octet-stream');
  const { error } = await supabase.storage.from(bucket).upload(path, buf, { contentType: mime, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path, kind: input.kind, mime };
}

export async function attachMediaToPost(input: {
  ownerId: string;
  postId: string;
  items: { url: string; path: string; kind: UploadKind; mime: string }[];
}) {
  if (!input.items.length) return;
  const { error } = await supabase.from('media').insert(
    input.items.map((m) => ({
      owner_id: input.ownerId,
      bucket: 'media',
      storage_path: m.path,
      url: m.url,
      kind: m.kind === 'file' ? 'document' : m.kind,
      mime: m.mime,
      post_id: input.postId,
    })),
  );
  if (error) throw new Error(error.message);
}

/** Reels = video media attached to a post, newest first. */
export async function listReels(limit = 20) {
  const { data, error } = await supabase
    .from('media')
    .select('id,url,kind,mime,duration_s,post_id,owner_id,created_at,owner:profiles!media_owner_id_fkey(username,display_name,avatar_url,is_verified)')
    .eq('kind', 'video')
    .not('post_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** One view per (media, viewer) — enforced by a unique index server-side. */
export async function registerReelView(mediaId: string) {
  await supabase.rpc('register_reel_view', { p_media: mediaId });
}

export async function toggleSaveItem(targetType: string, targetId: string, userId: string) {
  const { data } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle();
  if (data) {
    await supabase.from('bookmarks').delete().eq('id', data.id);
    return false;
  }
  await supabase.from('bookmarks').insert({ user_id: userId, target_type: targetType, target_id: targetId });
  return true;
}

export async function followState(targetId: string, meId: string) {
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', meId)
    .eq('following_id', targetId)
    .maybeSingle();
  return !!data;
}

export async function listFollowers(userId: string) {
  const { data, error } = await supabase
    .from('follows')
    .select('follower:profiles!follows_follower_id_fkey(id,username,display_name,avatar_url,is_verified)')
    .eq('following_id', userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => r.follower);
}

export async function listFollowing(userId: string) {
  const { data, error } = await supabase
    .from('follows')
    .select('following:profiles!follows_following_id_fkey(id,username,display_name,avatar_url,is_verified)')
    .eq('follower_id', userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => r.following);
}

export async function searchPeople(q: string) {
  const term = q.trim();
  let query = supabase
    .from('profiles')
    .select('id,username,display_name,avatar_url,is_verified,account_type,followers_count')
    .is('deleted_at', null)
    .limit(30);
  if (term) query = query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function myEarnings(userId: string) {
  const { data, error } = await supabase
    .from('creator_earnings')
    .select('gross_amount,platform_fee,net_amount,status,created_at,work_id,currency')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const sum = (st: string) =>
    rows.filter((r: any) => r.status === st).reduce((a: number, r: any) => a + Number(r.net_amount ?? 0), 0);
  return { rows, available: sum('available'), pending: sum('pending'), total: rows.reduce((a: number, r: any) => a + Number(r.net_amount ?? 0), 0) };
}
