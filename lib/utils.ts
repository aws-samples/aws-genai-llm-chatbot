import { SystemConfig } from "./shared/types";

/**
 * Helper function to get construct ID based on GenAIEH enablement
 */
export function getConstructId(baseId: string, config: SystemConfig): string {
  return config.genaieh?.enabled === true
    ? `${config.prefix}${baseId}`
    : baseId;
}
