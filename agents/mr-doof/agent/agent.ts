import { defineAgent } from "eve";
import { DEFAULT_MODEL } from "../shared/model.js";

/** Mr Doof — planning manager; delegates to brain + spark subagents. */
export default defineAgent({
  model: DEFAULT_MODEL,
  reasoning: "none",
  compaction: { thresholdPercent: 0.8 },
});
