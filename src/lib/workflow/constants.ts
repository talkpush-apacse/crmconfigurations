import type { EdgeLineType, EdgeMarkerType } from "@/lib/workflow/types";

export const NODE_COLOR_PALETTE = [
  { name: "Teal", background: "#F0FDFA", border: "#00BFA5" },
  { name: "Amber", background: "#FFFBEB", border: "#F59E0B" },
  { name: "Blue", background: "#EFF6FF", border: "#3B82F6" },
  { name: "Purple", background: "#F5F3FF", border: "#8B5CF6" },
  { name: "Pink", background: "#FDF2F8", border: "#EC4899" },
  { name: "Orange", background: "#FFF7ED", border: "#F97316" },
  { name: "Gray", background: "#F9FAFB", border: "#6B7280" },
  { name: "Green", background: "#ECFDF5", border: "#10B981" },
  { name: "Red", background: "#FEF2F2", border: "#EF4444" },
  { name: "Indigo", background: "#EEF2FF", border: "#6366F1" },
  { name: "Cyan", background: "#ECFEFF", border: "#06B6D4" },
  { name: "Rose", background: "#FFF1F2", border: "#F43F5E" },
] as const;

export const EDGE_LINE_TYPES: {
  value: EdgeLineType;
  label: string;
  description: string;
}[] = [
  { value: "bezier", label: "Curved", description: "Smooth curved line" },
  { value: "straight", label: "Straight", description: "Direct straight line" },
  { value: "step", label: "Elbow", description: "Right-angle connectors" },
  { value: "smoothstep", label: "Smooth Elbow", description: "Rounded right-angle connectors" },
];

export const EDGE_MARKER_TYPES: { value: EdgeMarkerType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "arrow", label: "Arrow (open)" },
  { value: "arrowclosed", label: "Arrow (filled)" },
];

export const EDGE_STROKE_COLORS: { value: string; label: string }[] = [
  { value: "#6B7280", label: "Gray (default)" },
  { value: "#00BFA5", label: "Teal" },
  { value: "#3B82F6", label: "Blue" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#EF4444", label: "Red" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#10B981", label: "Green" },
  { value: "#EC4899", label: "Pink" },
];

export const ANNOTATION_FILL_PRESETS = [
  { label: "Transparent", value: "transparent" },
  { label: "Teal",        value: "#E6FAF8" },
  { label: "Amber",       value: "#FFFBEB" },
  { label: "Purple",      value: "#F5F3FF" },
  { label: "Blue",        value: "#EFF6FF" },
  { label: "Pink",        value: "#FDF2F8" },
  { label: "White",       value: "#FFFFFF" },
  { label: "Dark",        value: "#1F2937" },
] as const;

export const ANNOTATION_BORDER_PRESETS = [
  { label: "None",   value: "none" },
  { label: "Teal",   value: "#00BFA5" },
  { label: "Amber",  value: "#F59E0B" },
  { label: "Purple", value: "#8B5CF6" },
  { label: "Blue",   value: "#3B82F6" },
  { label: "Gray",   value: "#6B7280" },
  { label: "Black",  value: "#111827" },
] as const;

// Scoping questions for the SE to ask during the session
