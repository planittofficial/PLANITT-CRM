export type SmartPasteResult = {
  title?: string;
  description?: string;
  priority?: string;
  checklistText?: string;
};

export function parseSmartPaste(
  text: string
): SmartPasteResult {
  const result: SmartPasteResult =
    {};

  const lines =
    text
      .split("\n")
      .map((x) =>
        x.trim()
      );

  const subtasks =
    [];

  for (
    const line
    of lines
  ) {
    const lower =
      line.toLowerCase();

    if (
      lower.startsWith(
        "title:"
      )
    ) {
      result.title =
        line
          .replace(
            /^title:/i,
            ""
          )
          .trim();
    }

    else if (
      lower.startsWith(
        "description:"
      )
    ) {
      result.description =
        line
          .replace(
            /^description:/i,
            ""
          )
          .trim();
    }

    else if (
      lower.startsWith(
        "priority:"
      )
    ) {
      result.priority =
        line
          .replace(
            /^priority:/i,
            ""
          )
          .trim()
          .toUpperCase();
    }

    else if (
      line.match(
        /^[-*]\s/
      ) ||
      line.match(
        /^\d+\./
      )
    ) {
      subtasks.push(
        line.replace(
          /^[-*\d. ]+/,
          ""
        )
      );
    }
  }

  result.checklistText =
    subtasks.join(
      "\n"
    );

  if (
    !result.title
  ) {
    result.title =
      lines[0];
  }

  if (
    !result.description
  ) {
    result.description =
      lines
        .slice(1)
        .join("\n");
  }

  return result;
}