-- Call history entries: a "call" message whose details (voice/video,
-- outcome, duration) are end-to-end encrypted like any other message.
alter table public.chat_messages drop constraint chat_messages_kind_check;
alter table public.chat_messages add constraint chat_messages_kind_check
  check (kind in ('text', 'voice', 'audio', 'image', 'video', 'file', 'call'));

alter table public.chat_messages drop constraint chat_messages_media_for_audio;
alter table public.chat_messages add constraint chat_messages_media_for_audio check (
  deleted_at is not null or (kind in ('text', 'call')) = (media_path is null)
);

create index if not exists chat_messages_call_idx
  on public.chat_messages (created_at desc) where kind = 'call';
