/* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
export function removeAssetHashes(templateJson: { [key: string]: any }) {
  // Replace every value changing on every build. Hash depends of the current folder path
  Object.keys(templateJson.Resources).forEach((key) => {
    if (templateJson.Resources[key].Properties?.Code?.S3Key) {
      templateJson.Resources[key].Properties.Code.S3Key = "Dummy";
    }
    if (templateJson.Resources[key].Properties?.Content?.S3Key) {
      templateJson.Resources[key].Properties.Content.S3Key = "Dummy";
    }
    if (templateJson.Resources[key].Properties?.SourceObjectKeys) {
      templateJson.Resources[key].Properties.SourceObjectKeys = ["Dummy"];
    }
    if (templateJson.Resources[key].Properties?.ContainerProperties?.Image) {
      templateJson.Resources[key].Properties.ContainerProperties.Image = [
        "Dummy",
      ];
    }
  });
}
