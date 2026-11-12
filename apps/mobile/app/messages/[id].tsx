import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Pressable, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { conversationMessages, sendMessage } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { palette, radius } from '../../src/lib/theme';
import { Loader } from '../../src/components/ui';
import { uploadWithProgress } from '../../src/lib/upload';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuth((s) => s.me);
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState<string[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const listRef = useRef<FlatList>(null);

  async function load() {
    if (!id) return;
    setMessages(await conversationMessages(id));
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  // Realtime: new messages, edits, deletions
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`conv-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'typing_indicators', filter: `conversation_id=eq.${id}` }, (payload: any) => {
        const row = payload.new;
        setTyping((prev) => {
          const others = prev.filter((u) => u !== row.user_id);
          return row.user_id !== me?.id ? [...others, row.user_id] : others;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, me?.id]);

  // Typing heartbeat (throttled to 1 write / 2s)
  const lastBeat = useRef(0);
  function beat() {
    if (!me || !id) return;
    const now = Date.now();
    if (now - lastBeat.current < 2000) return;
    lastBeat.current = now;
    supabase.from('typing_indicators').upsert({ conversation_id: id, user_id: me.id, updated_at: new Date().toISOString() }).then(() => {});
  }

  async function send() {
    if (!me || !id || !text.trim()) return;
    const body = text.trim();
    setText('');
    await sendMessage(id, me.id, body);
    load();
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
  }

  async function sendAttachment(uri: string, name: string, mime: string, kind: 'image' | 'video' | 'file') {
    if (!me || !id) return;
    setAttachmentBusy(true);
    try {
      const bucket = kind === 'file' ? 'documents' : 'media';
      const uploaded = await uploadWithProgress({ bucket, uri, fileName: name, mime, ownerId: me.id });
      const { error } = await supabase.from('messages').insert({
        conversation_id: id,
        sender_id: me.id,
        body: '',
        kind,
        media_url: uploaded.url,
        file_name: name,
      });
      if (error) throw new Error(error.message);
      await load();
    } catch (error) {
      Alert.alert('Attachment failed', (error as Error).message);
    } finally {
      setAttachmentBusy(false);
    }
  }

  async function pickChatMedia() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Permission required', 'Allow photo library access to attach media.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const kind = asset.type === 'video' ? 'video' : 'image';
    await sendAttachment(asset.uri, asset.fileName || `chat-${Date.now()}.${kind === 'video' ? 'mp4' : 'jpg'}`, asset.mimeType || (kind === 'video' ? 'video/mp4' : 'image/jpeg'), kind);
  }

  async function pickChatFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const file = result.assets[0];
    await sendAttachment(file.uri, file.name, file.mimeType || 'application/octet-stream', 'file');
  }

  if (loading) return <Loader />;

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 20 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.sender_id === me?.id;
          return (
            <View style={[s.bubble, mine ? s.mine : s.theirs]}>
              {item.kind === 'image' && item.media_url ? <Image source={{ uri: item.media_url }} style={{ width: 210, height: 190, borderRadius: 10, marginBottom: 5 }} resizeMode="cover" /> : null}
              {item.kind !== 'text' && item.kind !== 'image' ? <Text style={[s.msg, mine && { color: '#1A1405' }]}>{item.kind === 'video' ? '▶ Video attachment' : item.file_name || 'File attachment'}</Text> : null}
              {item.body ? <Text style={[s.msg, mine && { color: '#1A1405' }]}>{item.body}</Text> : null}
              <Text style={[s.time, mine && { color: '#4A3C10' }]}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {item.edited_at ? ' · edited' : ''}
              </Text>
            </View>
          );
        }}
      />

      {typing.length > 0 && <Text style={s.typing}>typing…</Text>}

      <View style={[s.composer, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable onPress={pickChatMedia} disabled={attachmentBusy} style={s.attach}><Text style={s.attachTxt}>＋</Text></Pressable>
        <Pressable onPress={pickChatFile} disabled={attachmentBusy} style={s.attach}><Text style={s.attachTxt}>▤</Text></Pressable>
        <TextInput
          value={text}
          onChangeText={(v) => { setText(v); beat(); }}
          placeholder="Message…"
          placeholderTextColor={palette.muted}
          style={s.input}
          multiline
        />
        <Pressable onPress={send} style={s.send} disabled={!text.trim()}>
          <Text style={{ color: '#1A1405', fontWeight: '800' }}>›</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.ink },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 14 },
  mine: { alignSelf: 'flex-end', backgroundColor: palette.gold, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, borderBottomLeftRadius: 4 },
  msg: { color: palette.text, fontSize: 14, lineHeight: 20 },
  time: { color: palette.muted, fontSize: 9, marginTop: 5, alignSelf: 'flex-end' },
  typing: { color: palette.muted, fontSize: 10, paddingHorizontal: 18, paddingBottom: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.line, backgroundColor: '#101013' },
  input: { flex: 1, maxHeight: 110, color: palette.text, backgroundColor: '#0F0F12', borderWidth: 1, borderColor: palette.line, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  attach: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center' },
  attachTxt: { color: palette.goldSoft, fontSize: 20, fontWeight: '700' },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.gold, alignItems: 'center', justifyContent: 'center' },
});
