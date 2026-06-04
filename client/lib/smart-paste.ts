export type SmartPasteResult = {
  title: string;
  description: string;
  priority: "URGENT"| "LOW" | "MEDIUM" | "HIGH";
  checklistItems: string[];
};

const PRIORITIES = [
   "URGENT", 
  "LOW",
  "MEDIUM",
  "HIGH",
] as const;

const PRIORITY_ALIASES = {
  urgent: "URGENT",
  high: "HIGH",
  med: "MEDIUM",
  medium: "MEDIUM",
  low: "LOW",
} as const;

export function parseSmartTaskPaste(
  text: string
): SmartPasteResult {

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let title = "";
  let description = "";

  let priority:
    SmartPasteResult["priority"] =
      "MEDIUM";

  const checklistItems: string[] = [];
  let insideChecklist =
  false;
  let insideDescription = false;

  for (const line of lines) {


    const lower =
      line.toLowerCase();

      if (lower.startsWith("title:")) {

  title =
    line
      .split(":")
      .slice(1)
      .join(":")
      .trim();

  continue;

}

if (
  lower.startsWith(
    "checklist:"
  )
) {

  insideChecklist =
    true;

  continue;

}

if (
  /^priority\s*:/.test(lower)
){

  const value =
    lower
      .replace(
        /^priority\s*:/,
        ""
      )
      .trim();

  const detected =
    PRIORITY_ALIASES[
      value as keyof typeof PRIORITY_ALIASES
    ];

  if (detected) {
    priority = detected;
  }

  continue;

}

if (
  lower.startsWith("description:")
) {

  description =
    line
      .split(":")
      .slice(1)
      .join(":")
      .trim();

  insideDescription =
    true;

  continue;

}

    // title
    if (
  !title &&
  (
    line.startsWith("#") ||
    lower.startsWith("title:")
  )
) {

  title =
    line
      .replace(/^#\s*/, "")
      .replace(/^title\s*:/i, "")
      .trim();

  continue;

}

   

    // priority
    const detectedAlias =
  Object.entries(
    PRIORITY_ALIASES
  ).find(([key]) =>
    lower.includes(key)
  );

if (detectedAlias) {

  priority =
    detectedAlias[1];

  continue;

}

 const remainingLines =
  lines.slice(lines.indexOf(line));

const allShortLines =
  remainingLines.length >= 2 &&
  remainingLines.every(
    (item) =>
      item.length < 80 &&
      !item.includes(":") &&
      !item.endsWith(".")
  );

if (allShortLines) {

  checklistItems.push(
    ...remainingLines
  );

  break;

}
if (
  insideDescription &&
  !lower.startsWith("checklist:")
) {

  description +=
    `${description ? "\n" : ""}${line}`;

  continue;

}

    // checklist
    const isChecklist =
      /^[-*•]/.test(line) ||
      /^\d+\./.test(line);

    if (isChecklist) {

      checklistItems.push(
        line
          .replace(/^[-*•]\s*/, "")
          .replace(/^\d+\.\s*/, "")
      );

      continue;

    }

    if (
  insideChecklist
) {

  checklistItems.push(
    line
      .replace(/^[-*•]\s*/, "")
      .replace(/^\d+\.\s*/, "")
  );

  continue;

}
    // description
    description +=
      `${line}\n`;

  }

  const hasStructure =
  checklistItems.length > 0 ||
  title.startsWith("#") ||
  lines.some((line) =>
    line.toLowerCase().includes("priority")
  );

return {
  title:
    hasStructure
      ? title 
      : "",

  description:
    description.trim(),

  priority,

  checklistItems,
};

}
