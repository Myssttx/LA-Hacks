-- Seed the demo building: The Dock, 400 NW 26th St (Wynwood).
-- Upload its mesh to scans/the_dock/scan.glb (and scan.usdz) and point scan_url at it.

insert into public.buildings (id, address, lat, lng, scan_url, is_demo, created_at)
values (
  'e5a3fddc-e22c-431c-a5d3-ee29ef8604d1',
  '400 NW 26th St, Miami, FL 33127',
  25.8012674435035,
  -80.202171638964,
  null,
  true,
  '2026-06-05T01:31:20.939075+00:00'
)
on conflict (id) do update
  set address = excluded.address,
      lat = excluded.lat,
      lng = excluded.lng,
      is_demo = excluded.is_demo;
