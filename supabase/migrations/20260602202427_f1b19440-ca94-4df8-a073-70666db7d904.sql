
-- 1) Remove self-insert on workspace_members; only owners/admins can insert directly.
DROP POLICY IF EXISTS members_insert_owner ON public.workspace_members;
CREATE POLICY members_insert_owner ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    has_workspace_role(workspace_id, 'owner'::workspace_role)
    OR has_workspace_role(workspace_id, 'admin'::workspace_role)
  );

-- 2) Fix mutable search_path on set_updated_at
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- 3) Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon, keep authenticated for RLS use
REVOKE ALL ON FUNCTION public.has_workspace_role(uuid, workspace_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, workspace_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated;
