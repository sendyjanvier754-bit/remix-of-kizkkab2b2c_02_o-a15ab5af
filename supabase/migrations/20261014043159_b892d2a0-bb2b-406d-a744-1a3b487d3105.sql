UPDATE public.categories SET parent_id='bf49cba8-a789-476a-90e5-1941431efc68' WHERE id IN ('7fc8aa86-52b9-44d5-90eb-97df6dd585ef','abb67929-5770-431d-ac1d-c8724942e404','35e0367a-00ef-471f-a8c1-a83d67439e0c','ac9f61c5-1e75-4af7-b008-a47d817c0e2d','811d7c5f-5894-4268-b2f7-529683f54b49','b23d7daf-6c34-4d86-b4a5-507a2ccead7a','cc065a8d-c16c-40dc-ac6a-e3e4e9d935b6');
UPDATE public.categories SET parent_id='4021d9a9-f910-41cb-8682-b5badee48659' WHERE id='7301f103-98bb-424d-abb3-dac641a9766f';
UPDATE public.categories SET parent_id='5aae6db6-c0c7-484a-aea1-1f6b0c7a7474' WHERE id='ce6d215c-3f5d-44cc-977a-571cfdc3939d';
UPDATE public.categories SET parent_id='15bfe0cd-a437-4b2f-bcb3-648e333f0cb7' WHERE id='bc4db869-f70a-42c7-93bd-3789536000f1';
UPDATE public.categories SET parent_id='4fe96233-cd51-4764-b517-5892b9e55a2b' WHERE id='4550bb0a-b3c9-4d00-8aed-6920ce832ef1';
UPDATE public.categories SET parent_id='2ba1bd50-8164-4d91-ba76-e06696e03676' WHERE id='c339cb0e-16d1-4412-a41d-24082fd03b8d';
UPDATE public.categories SET parent_id='ba666aed-b488-4e74-8d0a-0dde76e452de' WHERE id IN ('82964d6b-78a7-4179-8385-1dc8db6895db','1ff0b38e-b44f-46d1-9fe6-3248a0ef9933','ba5e22ca-eb69-4185-8b49-48d39e9cd140');
UPDATE public.categories SET parent_id='d5901ebb-b07e-465a-bed1-fcb44787bed6' WHERE id IN ('453b90fb-8bba-4789-b055-2397c477eb15','2ebfe615-aa42-4577-afe5-909d8359b587');
UPDATE public.categories SET sort_order = CASE id
 WHEN 'bf49cba8-a789-476a-90e5-1941431efc68' THEN 1 WHEN '53855a0d-d33e-4ad0-837d-f9bf42259876' THEN 2
 WHEN '4021d9a9-f910-41cb-8682-b5badee48659' THEN 3 WHEN '5aae6db6-c0c7-484a-aea1-1f6b0c7a7474' THEN 4
 WHEN '15bfe0cd-a437-4b2f-bcb3-648e333f0cb7' THEN 5 WHEN '4fe96233-cd51-4764-b517-5892b9e55a2b' THEN 6
 WHEN '2ba1bd50-8164-4d91-ba76-e06696e03676' THEN 7 WHEN 'ba666aed-b488-4e74-8d0a-0dde76e452de' THEN 8
 WHEN 'd5901ebb-b07e-465a-bed1-fcb44787bed6' THEN 9 END
WHERE parent_id IS NULL AND id IN ('bf49cba8-a789-476a-90e5-1941431efc68','53855a0d-d33e-4ad0-837d-f9bf42259876','4021d9a9-f910-41cb-8682-b5badee48659','5aae6db6-c0c7-484a-aea1-1f6b0c7a7474','15bfe0cd-a437-4b2f-bcb3-648e333f0cb7','4fe96233-cd51-4764-b517-5892b9e55a2b','2ba1bd50-8164-4d91-ba76-e06696e03676','ba666aed-b488-4e74-8d0a-0dde76e452de','d5901ebb-b07e-465a-bed1-fcb44787bed6');