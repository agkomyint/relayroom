import { defineInstructions } from "eve/instructions";
import { brainInstructions } from "../shared/personalities/brain.js";

export default defineInstructions({ markdown: brainInstructions });
