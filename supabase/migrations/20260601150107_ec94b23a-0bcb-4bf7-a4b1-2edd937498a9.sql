
-- revoke direct execute on trigger-only functions
revoke execute on function public.handle_new_user() from public, authenticated;
revoke execute on function public.set_updated_at() from public, authenticated;

-- helpers used by RLS: only authenticated needs execute (not anon/public)
revoke execute on function public.is_workspace_member(uuid) from public, anon;
revoke execute on function public.has_workspace_role(uuid, public.workspace_role) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, public.workspace_role) to authenticated;
