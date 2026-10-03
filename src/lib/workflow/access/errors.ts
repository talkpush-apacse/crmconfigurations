/** A problem with a request that a person can understand and fix. Everything else becomes "Something went wrong". */
export class AccessError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code?: string
  ) {
    super(message);
    this.name = "AccessError";
  }
}

export const notFound = (what: string) => new AccessError(`${what} not found`, 404, "not_found");
export const badRequest = (message: string) => new AccessError(message, 400, "bad_request");
export const forbidden = (message = "You do not have permission to do that.") => new AccessError(message, 403, "forbidden");
