"use client";

interface SectionHeaderProps {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-6">
      <div className="rounded-t-lg bg-primary px-4 py-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {description && (
        <div className="border-x border-b bg-gray-50 px-4 py-3">
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      )}
    </div>
  );
}
