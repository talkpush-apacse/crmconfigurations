"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FileUploadCellProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  accept?: string;
}

export function FileUploadCell({
  value,
  onChange,
  placeholder = "Upload file or paste URL",
  accept = "image/*,.pdf,.svg",
}: FileUploadCellProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImageUrl = value && /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(value);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "branding");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      onChange(data.url);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // If there's a value, show it with preview + actions
  if (value && !editingUrl) {
    return (
      <div className="space-y-2">
        {/* Thumbnail preview for images */}
        {isImageUrl && (
          <div className="relative w-full h-16 rounded border bg-gray-50 overflow-hidden">
            <Image
              src={value}
              alt="Preview"
              fill
              className="object-contain"
              unoptimized={value.startsWith("blob:") || value.startsWith("data:")}
            />
          </div>
        )}

        {/* URL display + actions */}
        <div className="flex items-center gap-1.5">
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 truncate text-xs text-blue-600 hover:underline"
            title={value}
          >
            <ExternalLink className="inline h-3 w-3 mr-1" />
            {value.split("/").pop() || value}
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary shrink-0"
            onClick={() => setEditingUrl(true)}
            title="Edit URL"
          >
            <Upload className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onChange("")}
            title="Remove"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  // Empty or editing: show upload button + URL input
  return (
    <div className="space-y-2">
      {/* Upload button */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />
      <Button
        variant="outline"
        size="sm"
        className={cn("w-full h-9 text-xs", uploading && "pointer-events-none")}
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Choose File
          </>
        )}
      </Button>

      {/* OR divider */}
      <div className="relative flex items-center my-1">
        <div className="flex-1 border-t border-gray-200" />
        <span className="mx-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">or</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* Manual URL input */}
      <Input
        value={editingUrl ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditingUrl(false)}
        placeholder={placeholder}
        className="h-8 text-xs"
      />

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
