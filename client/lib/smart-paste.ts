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

  for (const line of lines) {

    const lower =
      line.toLowerCase();

    // title
    if (!title) {

      title =
        line.replace(/^#\s*/, "");

      continue;

    }

    // priority
    const detectedPriority =
  PRIORITIES.find((p) =>
    lower.includes(
      p.toLowerCase()
    )
  );

if (detectedPriority) {

  priority =
    detectedPriority;

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

    // description
    description +=
      `${line}\n`;

  }

  return {

    title:
      title || "Untitled task",

    description:
      description.trim(),

    priority,

    checklistItems,

  };

}
console.log(
  parseSmartTaskPaste(`
# Build Dashboard

URGENT

- Add charts
- Add analytics
`)
);