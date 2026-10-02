export class TrackerError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400
  ) {
    super(message);
    this.name = "TrackerError";
  }
}

export const notFound = (what: string) => new TrackerError(`${what} not found`, 404);
export const badRequest = (message: string) => new TrackerError(message, 400);
