"use client";

interface SectionHeaderProps {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-8 rounded-xl border border-border bg-card px-6 py-5">
      <h2 className="text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[29px]">
        {title}
      </h2>
      {description && (
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
          {description}
        </p>
      )}
    </div>
  );
}
