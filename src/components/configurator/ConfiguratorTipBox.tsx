import { Lightbulb } from "lucide-react";

export function ConfiguratorTipBox({ tip }: { tip: string }) {
  return (
    <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <p>{tip}</p>
    </div>
  );
}
