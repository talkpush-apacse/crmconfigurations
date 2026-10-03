"use client";

import { NODE_TYPE_CONFIG, ACTOR_CONFIG } from "@/lib/workflow/types";

const FEASIBILITY_ITEMS = [
  { label: "Confirmed", color: "bg-green-500", desc: "Fully supported by Talkpush" },
  { label: "Likely", color: "bg-blue-400", desc: "Should work, verify with team" },
  { label: "Needs Review", color: "bg-amber-500", desc: "Uncertain, to be confirmed" },
];

/** `showFeasibility` is false on client pages unless staff chose to show feasibility to clients. */
export default function WorkflowLegend({ showFeasibility = true }: { showFeasibility?: boolean }) {
  return (
    <div className="border-t border-gray-200 bg-white px-6 py-4">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Legend
      </p>

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {/* Node types */}
        <div>
          <p className="text-[10px] font-medium text-gray-400 mb-1.5">Node Types</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(NODE_TYPE_CONFIG).map(([type, cfg]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm border shrink-0"
                  style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
                />
                <span className="text-[11px] text-gray-600">{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actor types */}
        <div>
          <p className="text-[10px] font-medium text-gray-400 mb-1.5">Actors</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(ACTOR_CONFIG).map(([type, cfg]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cfg.color }}
                />
                <span className="text-[11px] text-gray-600">{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Feasibility */}
        {showFeasibility && (
        <div>
          <p className="text-[10px] font-medium text-gray-400 mb-1.5">Feasibility</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {FEASIBILITY_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5" title={item.desc}>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.color}`} />
                <span className="text-[11px] text-gray-600">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
