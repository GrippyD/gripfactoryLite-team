/** A GRIPCasting refusal. Caught by the GRIPCasting routes and answered as
 * JSON `{ error }`. It is not the app's HttpError, so a miss does not render
 * an HTML error page. */

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
