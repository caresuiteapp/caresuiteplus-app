-- Allow authenticated tenant members to delete assist visits and legacy assignments.
GRANT DELETE ON public.assist_visits TO authenticated;
GRANT DELETE ON public.assignments TO authenticated;
