"use client";

interface SectionHeaderProps {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-6">
      <div className="rounded-t-lg border-l-4 border-blue-600 bg-gray-50 px-4 py-3">
        <h2 className="text-[22px] font-semibold text-gray-900 leading-tight">{title}</h2>
      </div>
      {description && (
        <div className="border-x border-b bg-white px-4 py-3">
          <p className="text-[14px] text-gray-500">{description}</p>
        </div>
      )}
    </div>
  );
}
