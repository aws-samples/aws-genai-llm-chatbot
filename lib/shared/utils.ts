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

  static getDefaultEmbeddingsModel(config: SystemConfig): string {
    const defaultModel = config.rag.embeddingsModels.find(
      (model) => model.default === true
    );

    if (!defaultModel) {
      throw new Error("No default embeddings model found");
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

  static getName(config: SystemConfig, value: string) {
    const prefix = config.prefix;
    let name = prefix && prefix.length > 0 ? `${prefix}-${value}` : value;
    name = name.slice(0, 32); // maxLength: 32

    return name;
  }
}
