-- Allow encrypted photos, videos and documents alongside text, voice and audio.
alter table public.chat_messages drop constraint chat_messages_kind_check;
alter table public.chat_messages add constraint chat_messages_kind_check
  check (kind in ('text', 'voice', 'audio', 'image', 'video', 'file'));
