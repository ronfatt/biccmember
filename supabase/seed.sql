insert into public.workshops (title, track, starts_at, room, capacity, preview)
values
  ('Expressive Entrances', 'Stagecraft', '2026-08-17 10:00:00+08', 'Studio Red', 24, 'Build a strong first thirty seconds with movement, silence, and focus.'),
  ('Gentle Comedy in Care Spaces', 'Outreach', '2026-08-17 14:00:00+08', 'Studio Teal', 18, 'A practical session for consent-led clowning in hospitals and shelters.'),
  ('Balloon Character Lab', 'Props', '2026-08-18 11:30:00+08', 'Workshop Hall', 30, 'Turn simple balloon forms into readable characters and quick stories.'),
  ('Performer Portfolio Clinic', 'Career', '2026-08-19 09:30:00+08', 'Mentor Lounge', 12, 'Small-group feedback for bios, show blurbs, and performance submissions.');

insert into public.announcements (title, body, audience)
values
  ('Delegate check-in opens', 'Digital pass check-in is available from 8:00 AM at the convention desk.', 'delegates'),
  ('Outreach signup live', 'Delegates can now join the community outreach visit shortlist.', 'delegates'),
  ('Free hub is open', 'Browse previews, meet members, and upgrade when you are ready for full access.', 'members');
