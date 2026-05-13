export type CameraStreamState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "granted"; stream: MediaStream }
  | { status: "denied" }
  | { status: "not-found" }
  | { status: "error"; message: string };
