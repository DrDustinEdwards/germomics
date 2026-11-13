import { useFetcher } from "react-router";
import { Icon, iconTrash } from "capsomer/react/icons";
import { confirmSubmit } from "capsomer/behavior/confirm-dialog";

// A list row's delete button: asks first (Capsomer's confirm dialog), then posts intent=delete with the row's id to the
// page's own action. The people and soundbites lists share it.
export function DeleteForm({
  id,
  label,
  title,
  action,
}: {
  id: number;
  label: string;
  title: string;
  action: string;
}) {
  const del = useFetcher();
  return (
    <del.Form method="post" onSubmit={(e) => confirmSubmit(e, { title, action })}>
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={id} />
      <button
        aria-label={label}
        className="grid h-7 w-7 place-items-center rounded text-muted hover:text-brand"
      >
        <Icon d={iconTrash} className="size-3.5" />
      </button>
    </del.Form>
  );
}
