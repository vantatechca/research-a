import { cn, getPriorityColor } from "@/lib/utils";

export function PriorityBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border",
        getPriorityColor(score)
      )}
    >
      {score.toFixed(0)}
    </span>
  );
}
