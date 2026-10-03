/**
 * Turns the JSON-Schema fragments the original workflow tools were written with into zod, which is what this
 * app's MCP toolkit advertises. Only the shapes those 29 tools use are supported: string, number, boolean,
 * object, array, enums, ["object","null"], min/max, descriptions. Anything else throws at start-up (and in a test),
 * so a new schema feature cannot be silently dropped.
 */

import { z, type ZodRawShape, type ZodType } from "zod";

type Schema = {
  type?: string | string[];
  enum?: unknown[];
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Schema;
  minimum?: number;
  maximum?: number;
};

function shapeOf(schema: Schema): ZodRawShape {
  const required = new Set(schema.required ?? []);
  const shape: Record<string, ZodType> = {};
  for (const [key, child] of Object.entries(schema.properties ?? {})) {
    const zod = toZod(child);
    shape[key] = required.has(key) ? zod : zod.optional();
  }
  return shape as ZodRawShape;
}

export function toZod(schema: Schema): ZodType {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const enumHasNull = Boolean(schema.enum?.includes(null));
  const nullable = types.includes("null") || enumHasNull;
  const type = types.find((t) => t !== "null");
  let out: ZodType;

  if (schema.enum) {
    out = z.enum(schema.enum.filter((v) => v !== null) as [string, ...string[]]);
  } else if (type === "string") {
    out = z.string();
  } else if (type === "number" || type === "integer") {
    let n = type === "integer" ? z.number().int() : z.number();
    if (schema.minimum !== undefined) n = n.min(schema.minimum);
    if (schema.maximum !== undefined) n = n.max(schema.maximum);
    out = n;
  } else if (type === "boolean") {
    out = z.boolean();
  } else if (type === "array") {
    out = z.array(schema.items ? toZod(schema.items) : z.unknown());
  } else if (type === "object") {
    const hasProps = Object.keys(schema.properties ?? {}).length > 0;
    if (!hasProps) out = z.record(z.string(), z.unknown());
    else out = schema.additionalProperties === true ? z.looseObject(shapeOf(schema)) : z.object(shapeOf(schema));
  } else {
    throw new Error(`Unsupported JSON schema fragment: ${JSON.stringify(schema).slice(0, 120)}`);
  }

  if (nullable) out = out.nullable();
  return schema.description ? out.describe(schema.description) : out;
}

export function inputShape(inputSchema: unknown): ZodRawShape {
  return shapeOf(inputSchema as Schema);
}
