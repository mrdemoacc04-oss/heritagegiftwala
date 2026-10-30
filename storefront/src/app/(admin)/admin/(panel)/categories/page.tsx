import { ActionForm, ConfirmButton, SubmitButton } from "@/components/admin/forms";
import { Card, Field, PageTitle, inputClass } from "@/components/admin/ui";
import { sql } from "@/lib/server/db";
import { site } from "@/lib/site";
import { deleteCategoryAction, saveCategoryAction } from "../../_actions/shop";
import { requireAdmin } from "@/lib/server/admin-auth";

export const metadata = { title: "Shelves" };

type Cat = { handle: string; title: string; blurb: string; cover: string; tint: string; sort: number; used: number };

const colourInput = "h-[42px] w-14 cursor-pointer rounded border border-stone-300 bg-white p-0.5";

export default async function CategoriesPage() {
  await requireAdmin();
  const cats = await sql<Cat>(
    "select c.handle, c.title, c.blurb, c.cover, c.tint, c.sort, (select count(*)::int from shop.products p where c.handle = any(p.categories)) as used from shop.categories c order by c.sort, c.title",
  );
  const products = await sql<{ handle: string; title: string }>("select handle, title from shop.products where status = 'active' order by title");

  return (
    <>
      <PageTitle
        title="Shelves"
        hint="The groups customers browse, like Soft Toys or Lamps & Clocks. Add a shelf, rename it, change its colour or order, or delete it. Put a product on a shelf from the product's own page (Shelves box)."
      />
      <div className="space-y-4">
        <Card title="Add a shelf">
          <ActionForm action={saveCategoryAction} resetOnSuccess className="grid items-end gap-3 md:grid-cols-6">
            <input type="hidden" name="mode" value="create" />
            <Field label="Name" className="md:col-span-2"><input name="title" required maxLength={80} placeholder="e.g. Rakhi & Festive" className={inputClass} /></Field>
            <Field label="Web address" hint="Letters, numbers and dashes, e.g. rakhi-festive" className="md:col-span-2">
              <input name="handle" required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="rakhi-festive" className={inputClass} />
            </Field>
            <Field label="Order" hint="Smaller comes first"><input name="sort" type="number" min={0} max={10000} defaultValue={cats.length} className={inputClass} /></Field>
            <Field label="Colour"><input name="tint" type="color" defaultValue="#F4E9D8" className={colourInput} /></Field>
            <Field label="Short line" className="md:col-span-2"><input name="blurb" maxLength={200} className={inputClass} /></Field>
            <Field label="Cover product" hint="Shown on the homepage" className="md:col-span-2">
              <select name="cover" defaultValue="" className={inputClass}>
                <option value="">None yet</option>
                {products.map((p) => <option key={p.handle} value={p.handle}>{p.title}</option>)}
              </select>
            </Field>
            <div className="md:col-span-2"><SubmitButton>Add shelf</SubmitButton></div>
          </ActionForm>
        </Card>

        {cats.map((c) => (
          <Card key={c.handle}>
            <ActionForm action={saveCategoryAction} className="grid items-end gap-3 md:grid-cols-6">
              <input type="hidden" name="old_handle" value={c.handle} />
              <Field label="Name" className="md:col-span-2"><input name="title" defaultValue={c.title} required maxLength={80} className={inputClass} /></Field>
              <Field label="Web address" hint="Changing it breaks old links to this shelf" className="md:col-span-2">
                <input name="handle" defaultValue={c.handle} required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputClass} />
              </Field>
              <Field label="Order"><input name="sort" type="number" min={0} max={10000} defaultValue={c.sort} className={inputClass} /></Field>
              <Field label="Colour"><input name="tint" type="color" defaultValue={c.tint} className={colourInput} /></Field>
              <Field label="Short line" className="md:col-span-2"><input name="blurb" defaultValue={c.blurb} maxLength={200} className={inputClass} /></Field>
              <Field label="Cover product" className="md:col-span-2">
                <select name="cover" defaultValue={c.cover} className={inputClass}>
                  <option value="">None</option>
                  {products.map((p) => <option key={p.handle} value={p.handle}>{p.title}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2"><SubmitButton kind="secondary">Save</SubmitButton></div>
            </ActionForm>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 text-xs text-stone-500">
              <span>
                <a href={`${site.url}/collections/${c.handle}`} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-stone-900">/collections/{c.handle} ↗</a> · {c.used} product{c.used === 1 ? "" : "s"}
              </span>
              <form action={deleteCategoryAction}>
                <input type="hidden" name="handle" value={c.handle} />
                <ConfirmButton message={c.used ? `Delete the shelf “${c.title}”? Its ${c.used} product${c.used === 1 ? "" : "s"} stay in the shop but are taken off this shelf.` : `Delete the shelf “${c.title}”?`}>Delete shelf</ConfirmButton>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
