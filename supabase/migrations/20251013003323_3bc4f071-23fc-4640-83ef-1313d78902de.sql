-- Insert the 6 existing pools from POOL_LIBRARY into pool_variants table
INSERT INTO pool_variants (pool_name, outline, shallow_end_position, deep_end_position, status, sort_order, published_at)
VALUES
  -- 1. Oxford 7.0 × 3.0m
  (
    'Oxford 7.0 × 3.0m',
    '[{"x":0,"y":0},{"x":7000,"y":0},{"x":7000,"y":3000},{"x":0,"y":3000},{"x":0,"y":0}]'::jsonb,
    '{"x":150,"y":1500}'::jsonb,
    '{"x":6850,"y":1500}'::jsonb,
    'published',
    1,
    now()
  ),
  -- 2. Latina 4.5 × 3.5m
  (
    'Latina 4.5 × 3.5m',
    '[{"x":0,"y":0},{"x":4500,"y":0},{"x":4500,"y":3500},{"x":0,"y":3500},{"x":0,"y":0}]'::jsonb,
    '{"x":150,"y":1750}'::jsonb,
    '{"x":4350,"y":1750}'::jsonb,
    'published',
    2,
    now()
  ),
  -- 3. Kensington 11.0 × 4.0m
  (
    'Kensington 11.0 × 4.0m',
    '[{"x":0,"y":0},{"x":11000,"y":0},{"x":11000,"y":4000},{"x":0,"y":4000},{"x":0,"y":0}]'::jsonb,
    '{"x":150,"y":2000}'::jsonb,
    '{"x":10850,"y":2000}'::jsonb,
    'published',
    3,
    now()
  ),
  -- 4. Istana 6.2 × 3.3m
  (
    'Istana 6.2 × 3.3m',
    '[{"x":0,"y":0},{"x":6200,"y":0},{"x":6200,"y":3300},{"x":0,"y":3300},{"x":0,"y":0}]'::jsonb,
    '{"x":150,"y":1650}'::jsonb,
    '{"x":6050,"y":1650}'::jsonb,
    'published',
    4,
    now()
  ),
  -- 5. Hayman 8.5 × 3.8m
  (
    'Hayman 8.5 × 3.8m',
    '[{"x":0,"y":0},{"x":8500,"y":0},{"x":8500,"y":3800},{"x":0,"y":3800},{"x":0,"y":0}]'::jsonb,
    '{"x":150,"y":1900}'::jsonb,
    '{"x":8350,"y":1900}'::jsonb,
    'published',
    5,
    now()
  ),
  -- 6. Harmony 7.0 × 2.5m
  (
    'Harmony 7.0 × 2.5m',
    '[{"x":0,"y":0},{"x":7000,"y":0},{"x":7000,"y":2500},{"x":0,"y":2500},{"x":0,"y":0}]'::jsonb,
    '{"x":150,"y":1250}'::jsonb,
    '{"x":6850,"y":1250}'::jsonb,
    'published',
    6,
    now()
  );