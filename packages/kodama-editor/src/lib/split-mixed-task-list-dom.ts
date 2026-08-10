function isTaskListItem(li: Element): boolean {
  return (
    li.classList.contains("task-list-item") || li.getAttribute("data-type") === "taskItem"
  );
}

/**
 * markdown-it-task-lists marks a whole `<ul>` as `.contains-task-list` when any
 * item is a task. TipTap's `taskList` may only contain `taskItem`, so mixed
 * bullet + task lists get schema-repaired into empty tasks / ordered lists.
 *
 * Split each mixed list into contiguous plain / task runs before TipTap parses.
 */
export function splitMixedTaskListDOM(root: ParentNode): void {
  const lists = [
    ...root.querySelectorAll("ul.contains-task-list, ul[data-type='taskList']"),
  ];

  for (const list of lists) {
    const items = [...list.children].filter((el): el is HTMLLIElement => el.tagName === "LI");
    if (items.length === 0) continue;

    const hasTask = items.some(isTaskListItem);
    const hasPlain = items.some((li) => !isTaskListItem(li));

    if (!hasTask) {
      list.classList.remove("contains-task-list");
      list.removeAttribute("data-type");
      continue;
    }

    if (!hasPlain) {
      list.classList.add("contains-task-list");
      list.setAttribute("data-type", "taskList");
      continue;
    }

    const parent = list.parentNode;
    if (!parent) continue;

    const fragment = document.createDocumentFragment();
    let currentRun: "task" | "plain" | null = null;
    let currentUl: HTMLUListElement | null = null;

    for (const li of items) {
      const run = isTaskListItem(li) ? "task" : "plain";
      if (run !== currentRun) {
        currentRun = run;
        currentUl = document.createElement("ul");
        if (run === "task") {
          currentUl.classList.add("contains-task-list");
          currentUl.setAttribute("data-type", "taskList");
        }
        fragment.appendChild(currentUl);
      }
      currentUl!.appendChild(li);
    }

    parent.insertBefore(fragment, list);
    parent.removeChild(list);
  }
}
