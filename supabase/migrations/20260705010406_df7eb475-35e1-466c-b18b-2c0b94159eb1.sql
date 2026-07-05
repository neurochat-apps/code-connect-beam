UPDATE public.transactions t
SET category_id = c.id
FROM public.categories c
WHERE t.category_id IS NULL
  AND c.workspace_id = t.workspace_id
  AND c.code = CASE
    WHEN t.type = 'ingreso' THEN '00001'
    WHEN t.type = 'egreso'  THEN '00004'
    WHEN t.type = 'neutro'  THEN '00011'
  END;