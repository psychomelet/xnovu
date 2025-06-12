set
  search_path = notify;

select
  func.supabase_expose_schema ();

-- create result views
select
  func.create_result_views ();

notify pgrst,
'reload schema';