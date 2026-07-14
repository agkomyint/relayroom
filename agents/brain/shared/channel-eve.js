import { eveChannel } from "eve/channels/eve";
import { localDev, placeholderAuth, vercelOidc } from "eve/channels/auth";

/** Shared HTTP channel policy for every local agent. */
export default eveChannel({
  auth: [vercelOidc(), localDev(), placeholderAuth()],
});
