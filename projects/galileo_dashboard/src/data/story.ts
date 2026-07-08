import storyJson from "./story.json";
import type { StoryData } from "./types";

/**
 * The guided pitch script: an ordered list of deep-linked stops with one
 * narrative line each. This is the file to edit after a monthly refresh.
 * Copy should describe how to read the tool, never hard-code figures — the
 * overview stop computes its numbers live from the trend data.
 */
export const story = storyJson as unknown as StoryData;
