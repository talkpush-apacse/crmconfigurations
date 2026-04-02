"use client";

interface SectionHeaderProps {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-8 rounded-[28px] bg-white/[0.82] px-6 py-6 shadow-sm ring-1 ring-slate-200/70 backdrop-blur-sm">
      <div className="flex flex-col gap-3">
        <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
          Configuration Workspace
        </span>
        <div>
          <h2 className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-[28px]">
            {title}
          </h2>
          {description && (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:text-[15px]">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
