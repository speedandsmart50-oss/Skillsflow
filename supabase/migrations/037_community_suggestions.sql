alter table public.support_tickets
  drop constraint if exists support_tickets_category_check;

alter table public.support_tickets
  add constraint support_tickets_category_check
  check (category in ('question', 'refund', 'other', 'suggestion'));
