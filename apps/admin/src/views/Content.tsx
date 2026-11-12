import { useEffect, useState } from 'react';
import { supabase, callAdmin, dt, type Role } from '../supabase';
import { Table, StatusBadge, Empty } from '../ui';

export default function Content({ role }: { role: Role }) {
  const [tab, setTab] = useState<'works' | 'posts' | 'stories' | 'groups'>('works');
  const [works, setWorks] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [status, setStatus] = useState<'all' | 'pending_review' | 'published' | 'rejected' | 'draft'>('pending_review');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function load() {
    let q = supabase
      .from('works')
      .select('id,title,kind,status,language,is_mature,is_premium,price,chapters_count,reads_count,created_at,published_at,author_id,profiles:author_id(username,display_name)')
      .order('created_at', { ascending: false })
      .limit(300);
    if (status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) setMsg({ kind: 'err', text: error.message });
    setWorks(data ?? []);

    const { data: p } = await supabase
      .from('posts')
      .select('id,body,visibility,likes_count,comments_count,created_at,profiles:author_id(username,display_name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);
    setPosts(p ?? []);

    const { data: s } = await supabase
      .from('stories')
      .select('id,caption,media_kind,privacy,expires_at,views_count,is_archived,created_at,profiles:author_id(username)')
      .order('created_at', { ascending: false })
      .limit(100);
    setStories(s ?? []);

    const { data: g } = await supabase
      .from('groups')
      .select('id,name,slug,privacy,category,members_count,created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    setGroups(g ?? []);
  }

  useEffect(() => { load(); }, [status]);

  async function decide(id: string, decision: 'published' | 'rejected') {
    try {
      await callAdmin({ action: 'review_work', work_id: id, decision, reason: decision === 'rejected' ? 'Does not meet guidelines' : null });
      setMsg({ kind: 'ok', text: `Work ${decision}` });
      load();
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    }
  }

  async function removePost(id: string) {
    const { error } = await supabase.from('posts').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    setMsg(error ? { kind: 'err', text: error.message } : { kind: 'ok', text: 'Post removed' });
    load();
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Works &amp; Content</h1>
          <div className="sub">Editorial queue, social feed moderation, stories and groups.</div>
        </div>
        <button onClick={load}>Refresh</button>
      </div>

      {msg && <div className={`alert ${msg.kind === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      <div className="pill-tabs">
        {(['works', 'posts', 'stories', 'groups'] as const).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'works' && (
        <>
          <div className="pill-tabs">
            {(['pending_review', 'published', 'rejected', 'draft', 'all'] as const).map((s) => (
              <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
          {works.length === 0 ? (
            <Empty text="No works in this bucket." />
          ) : (
            <Table head={['Title', 'Author', 'Kind', 'Lang', 'Ch.', 'Reads', 'Status', 'Actions']}>
              {works.map((w) => (
                <tr key={w.id}>
                  <td>
                    <b>{w.title}</b>
                    {w.is_premium && <span className="badge gold" style={{ marginLeft: 6 }}>premium</span>}
                    {w.is_mature && <span className="badge warn" style={{ marginLeft: 6 }}>18+</span>}
                  </td>
                  <td>{w.profiles?.display_name || w.profiles?.username}</td>
                  <td className="muted">{w.kind}</td>
                  <td className="muted">{w.language}</td>
                  <td className="muted">{w.chapters_count}</td>
                  <td className="muted">{w.reads_count}</td>
                  <td><StatusBadge value={w.status} /></td>
                  <td>
                    <div className="row">
                      <button className="sm primary" onClick={() => decide(w.id, 'published')}>Publish</button>
                      <button className="sm danger" onClick={() => decide(w.id, 'rejected')}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </>
      )}

      {tab === 'posts' && (
        posts.length === 0 ? <Empty text="No posts yet." /> : (
          <Table head={['Author', 'Body', 'Visibility', 'Likes', 'Comments', 'When', '']}>
            {posts.map((p) => (
              <tr key={p.id}>
                <td>{p.profiles?.display_name || p.profiles?.username}</td>
                <td style={{ maxWidth: 360 }}>{(p.body ?? '').slice(0, 140)}</td>
                <td className="muted">{p.visibility}</td>
                <td className="muted">{p.likes_count}</td>
                <td className="muted">{p.comments_count}</td>
                <td className="muted">{dt(p.created_at)}</td>
                <td><button className="sm danger" onClick={() => removePost(p.id)}>Remove</button></td>
              </tr>
            ))}
          </Table>
        )
      )}

      {tab === 'stories' && (
        stories.length === 0 ? <Empty text="No stories yet." /> : (
          <Table head={['Author', 'Kind', 'Caption', 'Privacy', 'Views', 'Expires']}>
            {stories.map((s) => (
              <tr key={s.id}>
                <td>{s.profiles?.username}</td>
                <td className="muted">{s.media_kind}</td>
                <td style={{ maxWidth: 300 }}>{(s.caption ?? '').slice(0, 90)}</td>
                <td className="muted">{s.privacy}</td>
                <td className="muted">{s.views_count}</td>
                <td className="muted">{dt(s.expires_at)}</td>
              </tr>
            ))}
          </Table>
        )
      )}

      {tab === 'groups' && (
        groups.length === 0 ? <Empty text="No groups yet." /> : (
          <Table head={['Name', 'Slug', 'Privacy', 'Category', 'Members', 'Created']}>
            {groups.map((g) => (
              <tr key={g.id}>
                <td><b>{g.name}</b></td>
                <td className="mono muted">/{g.slug}</td>
                <td className="muted">{g.privacy}</td>
                <td className="muted">{g.category}</td>
                <td className="muted">{g.members_count}</td>
                <td className="muted">{dt(g.created_at)}</td>
              </tr>
            ))}
          </Table>
        )
      )}
    </>
  );
}
