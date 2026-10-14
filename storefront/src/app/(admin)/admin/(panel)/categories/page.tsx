import { ActionForm, ConfirmButton, SubmitButton } from "@/components/admin/forms";
import { Card, Field, PageTitle, inputClass } from "@/components/admin/ui";
import { sql } from "@/lib/server/db";
import { deleteCategoryAction, saveCategoryAction } from "../../_actions/shop";
import { requireAdmin } from "@/lib/server/admin-auth";

export const metadata = { title: "Shelves" };

type Cat = { handle: string; title: string; blurb: string; cover: string; tint: string; sort: number; used: number };

export default async function CategoriesPage() {
  await requireAdmin();
  const cats = await sql<Cat>(
    "select c.handle, c.title, c.blurb, c.cover, c.tint, c.sort, (select count(*)::int from shop.products p where c.handle = any(p.categories)) as used from shop.categories c order by c.sort, c.title",
  );
  const products = await sql<{ handle: string; title: string }>("select handle, title from shop.products where status = 'active' and not hidden order by title");

  return (
    <>
      <PageTitle title="Shelves" hint="The groups customers browse, like Soft Toys or Lamps & Clocks. Each has a short line, a colour, and a cover product shown on the homepage." />
      <div className="space-y-4">
        {cats.map((c) => (
          <Card key={c.handle}>
            <ActionForm action={saveCategoryAction} className="grid items-end gap-3 md:grid-cols-[1.2fr_2fr_1.4fr_auto_90px_auto]">
              <input type="hidden" name="handle" value={c.handle} />
              <Field label="Name"><input name="title" defaultValue={c.title} required maxLength={80} className={inputClass} /></Field>
              <Field label="Short line"><input name="blurb" defaultValue={c.blurb} maxLength={200} className={inputClass} /></Field>
              <Field label="Cover product">
                <select name="cover" defaultValue={c.cover} className={inputClass}>
                  <option value="">None</option>
                  {products.map((p) => <option key={p.handle} value={p.handle}>{p.title}</option>)}
                </select>
              </Field>
              <Field label="Colour"><input name="tint" type="color" defaultValue={c.tint} className="h-[42px] w-14 cursor-pointer rounded border border-stone-300 bg-white p-0.5" /></Field>
              <Field label="Order"><input name="sort" type="number" min={0} max={10000} defaultValue={c.sort} className={inputClass} /></Field>
              <SubmitButton kind="secondary">Save</SubmitButton>
            </ActionForm>
            <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
              <span>/collections/{c.handle} · {c.used} product{c.used === 1 ? "" : "s"}</span>
              {c.used === 0 && (
                <form action={deleteCategoryAction}><input type="hidden" name="handle" value={c.handle} /><ConfirmButton message={`Delete the shelf “${c.title}”?`}>Delete shelf</ConfirmButton></form>
              )}
            </div>
          </Card>
        ))}
        <Card title="Add a shelf">
          <ActionForm action={saveCategoryAction} resetOnSuccess className="grid items-end gap-3 md:grid-cols-[1.2fr_1.2fr_2fr_auto_90px_auto]">
            <input type="hidden" name="mode" value="create" />
            <input type="hidden" name="cover" value="" />
            <Field label="Name"><input name="title" required maxLength={80} className={inputClass} /></Field>
            <Field label="Web address" hint="e.g. soft-toys"><input name="handle" required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputClass} /></Field>
            <Field label="Short line"><input name="blurb" maxLength={200} className={inputClass} /></Field>
            <Field label="Colour"><input name="tint" type="color" defaultValue="#F4E9D8" className="h-[42px] w-14 cursor-pointer rounded border border-stone-300 bg-white p-0.5" /></Field>
            <Field label="Order"><input name="sort" type="number" min={0} max={10000} defaultValue={cats.length} className={inputClass} /></Field>
            <SubmitButton>Add</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
