import type { FetcherWithComponents } from "react-router";
import { confirmSubmit } from "capsomer/behavior/confirm-dialog";
import { Icon, iconTrash } from "capsomer/react/icons";

// A list row's delete button: posts intent=delete and the row's id, after the confirm dialog.
export function DeleteRowForm({
  fetcher,
  id,
  label,
  title,
  action,
}: {
  fetcher: FetcherWithComponents<unknown>;
  id: number;
  label: string;
  title: string;
  action: string;
}) {
  return (
    <fetcher.Form method="post" onSubmit={(e) => confirmSubmit(e, { title, action })}>
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={id} />
      <button
        aria-label={label}
        className="grid h-7 w-7 place-items-center rounded text-muted hover:text-brand"
      >
        <Icon d={iconTrash} className="size-3.5" />
      </button>
    </fetcher.Form>
  );
}
