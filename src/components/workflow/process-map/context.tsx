"use client";

import { createContext, useContext } from "react";
import type { Scene } from "@/lib/workflow/process-map/scene";

/** The scene the current canvas is drawing. Process Map nodes and connectors look themselves up in it by id. */
export const ProcessMapContext = createContext<Scene | null>(null);
export const useProcessMapScene = () => useContext(ProcessMapContext);
