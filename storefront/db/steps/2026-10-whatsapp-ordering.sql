-- Orders move to WhatsApp (October 2026). A ONE-TIME data step. It is NOT part of `npm run db:migrate` (that runs often);
-- run it on purpose, once, with `npm run db:step -- 2026-10-whatsapp-ordering`, before the owner has typed in real prices.
-- It is also recorded in shop.applied_steps, so a second run does nothing:
--   * the paid gift-wrap add-on is gone, so its product is removed (past orders keep their own copy of what they bought)
--   * no price is shown until the owner types one into the control panel, so every price is cleared
-- Needs the 0001 migration first (it creates shop.applied_steps and lets a price be empty).

do $$
begin
  if not exists (select 1 from shop.applied_steps where name = '2026-10-whatsapp-ordering') then
    delete from shop.products where handle = 'gift-wrap';
    update shop.products set price = null, compare_at = null;
    insert into shop.applied_steps (name) values ('2026-10-whatsapp-ordering');
  end if;
end $$;
