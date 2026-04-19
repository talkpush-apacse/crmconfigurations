"use client";

interface ConfiguratorTipBoxProps {
  tip: string;
}

export function ConfiguratorTipBox({ tip }: ConfiguratorTipBoxProps) {
  return (
    <div className="mt-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2">
      <p className="text-xs text-yellow-800">
        <span className="font-semibold">Tip: </span>
        {tip}
      </p>
    </div>
  );
}
