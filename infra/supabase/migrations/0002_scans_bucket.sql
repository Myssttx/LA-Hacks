-- Public bucket for LiDAR scan meshes (scan.glb / scan.usdz per building).

insert into storage.buckets (id, name, public)
values ('scans', 'scans', true)
on conflict (id) do nothing;
