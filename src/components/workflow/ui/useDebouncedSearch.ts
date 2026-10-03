"use client";

import { useEffect, useState } from "react";

export function useDebouncedSearch(initialValue = "", delayMs = 300) {
  const [input, setInput] = useState(initialValue);
  const [query, setQuery] = useState(initialValue.trim());

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input.trim());
    }, delayMs);

    return () => clearTimeout(timer);
  }, [input, delayMs]);

  return { input, setInput, query };
}
