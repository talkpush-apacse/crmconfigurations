/**
 * MCP toolkit: the one place that knows how a tool is defined, registered and how its errors are shown.
 *
 * To add a tool, write a `defineTool({...})` in a module's tool file and add it to that module's list
 * (see docs/adding-an-mcp-tool.md). You do not touch routes, auth, error handling or the docs: the tool
 * list in .claude/skills/project-tracker-mcp/references/tools.md is generated from the definitions
 * (`npm run mcp:docs`), and tests/mcp-toolkit.test.ts fails if it drifts.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodError, type ZodRawShape, type z } from "zod";
import type { Actor } from "@/lib/tracker/actor";

/** `read` tools never change data. `write` tools do. Shown in the generated docs and checked by tests. */
export type ToolAccess = "read" | "write";

/** Who is calling. Handlers use `ctx.actor` for the activity log, never a hard-coded name. */
export interface ToolContext {
  actor: Actor;
  /**
   * True for a connection made by a read-only login. Such a connection is only given the tools that look at data;
   * tools that change data are not even offered to Claude.
   */
  readOnly?: boolean;
}

export interface ToolDefinition<S extends ZodRawShape = ZodRawShape> {
  /** snake_case, unique across every module that is served together. */
  name: string;
  /** What Claude reads to decide when to use the tool. Say what it does and any rule that matters. */
  description: string;
  access: ToolAccess;
  /** Zod fields for the inputs. Give every field `.describe()` text where the name is not obvious. */
  input: S;
  /** Return plain data. Throw to report a problem: the toolkit turns it into a safe message. */
  handler: (args: z.infer<z.ZodObject<S>>, ctx: ToolContext) => Promise<unknown>;
}

export type AnyTool = ToolDefinition<ZodRawShape>;

/** Identity helper: it exists so each handler's `args` is typed from its own `input`. */
export function defineTool<S extends ZodRawShape>(tool: ToolDefinition<S>): AnyTool {
  return tool as unknown as AnyTool;
}

export interface ToolModule {
  id: string;
  /** Name shown to the user when this module is served on its own. */
  name: string;
  /** Short guidance for Claude about how to use the module's tools together. */
  instructions?: string;
  tools: AnyTool[];
  /**
   * Tools that are registered the old way (server.tool(...)). Used while a module is being moved
   * onto defineTool; they behave exactly as before. Prefer `tools`.
   */
  legacy?: (server: McpServer) => void;
  /** Which of the legacy tools only read. A read-only connection gets these and no other legacy tool. */
  legacyReadTools?: ReadonlySet<string>;
  /** Errors whose message is written for people and safe to show as it is. Everything else gets a generic message. */
  isUserError?: (err: unknown) => err is Error;
  /** Prefix for server-side error logs, for example "tracker-mcp". */
  logPrefix?: string;
}

// ---------------------------------------------------------------------------
// results
// ---------------------------------------------------------------------------

export function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

async function runTool(module: ToolModule, fn: () => Promise<unknown>) {
  try {
    return ok(await fn());
  } catch (err) {
    if (err instanceof ZodError) {
      return fail(
        `Some fields need attention: ${err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`
      );
    }
    if (module.isUserError?.(err)) return fail(err.message);
    console.error(`[${module.logPrefix ?? module.id}] tool error:`, err instanceof Error ? err.message : err);
    return fail("Something went wrong. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// building a server
// ---------------------------------------------------------------------------

/** Throws if two tools share a name, because the second would silently replace the first. */
export function assertUniqueToolNames(modules: ToolModule[]): void {
  const seen = new Map<string, string>();
  for (const m of modules) {
    for (const t of m.tools) {
      const earlier = seen.get(t.name);
      if (earlier) throw new Error(`Tool name "${t.name}" is used by both "${earlier}" and "${m.id}"`);
      seen.set(t.name, m.id);
    }
  }
}

/**
 * A view of the server that only accepts the named tools. Used for the older, untagged tools: registering them through
 * this view means anything not on the list is simply never offered.
 */
export function onlyTools(server: McpServer, allowed: ReadonlySet<string>): McpServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop === "tool") {
        return (name: string, ...rest: unknown[]) =>
          allowed.has(name) ? (target.tool as (...a: unknown[]) => unknown)(name, ...rest) : undefined;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export function registerModule(server: McpServer, module: ToolModule, ctx: ToolContext): void {
  for (const tool of module.tools) {
    if (ctx.readOnly && tool.access !== "read") continue;
    server.tool(tool.name, tool.description, tool.input, async (args) =>
      runTool(module, () => tool.handler(args as never, ctx))
    );
  }
  if (module.legacy) {
    module.legacy(ctx.readOnly ? onlyTools(server, module.legacyReadTools ?? new Set()) : server);
  }
}

export interface ServerInfo {
  name: string;
  version: string;
  instructions?: string;
}

/** One MCP server serving the given modules for one caller. Stateless: build a fresh one per request. */
export function buildMcpServer(info: ServerInfo, modules: ToolModule[], ctx: ToolContext): McpServer {
  assertUniqueToolNames(modules);
  const base = info.instructions ?? modules.map((m) => m.instructions).filter(Boolean).join("\n\n");
  const instructions = ctx.readOnly
    ? `This connection is READ-ONLY (the person who connected it has a read-only login). Only tools that look at data are available. If asked to change anything, say it needs someone with an editor login.\n\n${base}`
    : base;
  const server = new McpServer(
    { name: info.name, version: info.version },
    instructions ? { instructions } : undefined
  );
  for (const m of modules) registerModule(server, m, ctx);
  return server;
}
