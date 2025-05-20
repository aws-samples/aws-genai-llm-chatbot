import { SystemConfig } from "./shared/types";

/**
 * Helper function to get construct ID based on Nexus enablement
 */
export function getConstructId(baseId: string, config: SystemConfig): string {
  return config.nexus?.enabled === true ? `${config.prefix}${baseId}` : baseId;
}
