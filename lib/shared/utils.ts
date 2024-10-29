import * as fs from "node:fs";
import * as path from "node:path";
import { SystemConfig } from "./types";

export abstract class Utils {
  static copyDirRecursive(sourceDir: string, targetDir: string): void {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir);
    }

    const files = fs.readdirSync(sourceDir);

    for (const file of files) {
      const sourceFilePath = path.join(sourceDir, file);
      const targetFilePath = path.join(targetDir, file);
      const stats = fs.statSync(sourceFilePath);

      if (stats.isDirectory()) {
        Utils.copyDirRecursive(sourceFilePath, targetFilePath);
      } else {
        fs.copyFileSync(sourceFilePath, targetFilePath);
      }
    }
  }

  static getDefaultEmbeddingsModel(config: SystemConfig): string | undefined {
    const defaultModel = config.rag.embeddingsModels.find(
      (model) => model.default === true
    );

    if (!defaultModel) {
      // No default embdeding is set in the config when Aurora or Opensearch are not used.
      return undefined;
    }

    return `${defaultModel.provider}::${defaultModel.dimensions}::${defaultModel.name}`;
  }

  static getDefaultCrossEncoderModel(config: SystemConfig): string {
    const defaultModel = config.rag.crossEncoderModels.find(
      (model) => model.default === true
    );

    if (!defaultModel) {
      throw new Error("No default cross encoder model found");
    }

    return `${defaultModel.provider}::${defaultModel.name}`;
  }

  static getName(config: SystemConfig, value: string, maxLength = 28): string {
    const prefix = config.prefix;
    let name = prefix && prefix.length > 0 ? `${prefix}-${value}` : value;

    // Convert name to lowercase
    name = name.toLowerCase();

    // Remove any characters that are not a-z, 0-9, or hyphen
    name = name.replace(/[^a-z0-9-]/g, "");

    // Ensure name doesn't start or end with a hyphen
    if (name.startsWith("-")) {
      name = name.slice(1);
    }
    if (name.endsWith("-")) {
      name = name.slice(0, -1);
    }

    // Ensure name is between 3 and 28 characters
    if (name.length < 3) {
      throw new Error(
        "Generated name is too short. It must be between 3 and 28 characters."
      );
    }
    name = name.slice(0, maxLength);

    // Ensure name starts with a lowercase letter
    if (!/^[a-z]/.test(name)) {
      throw new Error("Generated name must start with a lowercase letter.");
    }

    return name;
  }
}
