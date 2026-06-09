insert into public.workshops (id, title, track, starts_at, room, capacity, preview)
values
  ('11111111-1111-4111-8111-111111111101', 'Expressive Entrances', 'Stagecraft', '2026-08-17 10:00:00+08', 'Studio Red', 24, 'Build a strong first thirty seconds with movement, silence, and focus.'),
  ('11111111-1111-4111-8111-111111111102', 'Gentle Comedy in Care Spaces', 'Outreach', '2026-08-17 14:00:00+08', 'Studio Teal', 18, 'A practical session for consent-led clowning in hospitals and shelters.'),
  ('11111111-1111-4111-8111-111111111103', 'Balloon Character Lab', 'Props', '2026-08-18 11:30:00+08', 'Workshop Hall', 30, 'Turn simple balloon forms into readable characters and quick stories.'),
  ('11111111-1111-4111-8111-111111111104', 'Performer Portfolio Clinic', 'Career', '2026-08-19 09:30:00+08', 'Mentor Lounge', 12, 'Small-group feedback for bios, show blurbs, and performance submissions.')
on conflict (id) do update
set
  title = excluded.title,
  track = excluded.track,
  starts_at = excluded.starts_at,
  room = excluded.room,
  capacity = excluded.capacity,
  preview = excluded.preview;

insert into public.announcements (title, body, audience)
values
  ('Delegate check-in opens', 'Digital pass check-in is available from 8:00 AM at the convention desk.', 'delegates'),
  ('Outreach signup live', 'Delegates can now join the community outreach visit shortlist.', 'delegates'),
  ('Free hub is open', 'Browse previews, meet members, and upgrade when you are ready for full access.', 'members');
