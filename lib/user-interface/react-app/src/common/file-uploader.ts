import { FileUploadResult } from "../API";

export class FileUploader {
  upload(
    file: File,
    signature: FileUploadResult,
    onProgress: (uploaded: number) => void
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      const fields = signature.fields!.replace("{", "").replace("}", "");
      fields.split(",").forEach((f) => {
        const sepIdx = f.indexOf("=");
        const k = f.slice(0, sepIdx);
        const v = f.slice(sepIdx + 1);
        formData.append(k, v);
      });

      formData.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          if (xhr.status === 200 || xhr.status === 204) {
            resolve(true);
          } else {
            reject(false);
          }
        }
      };

      xhr.open("POST", signature.url, true);
      xhr.upload.addEventListener("progress", (event) => {
        onProgress(event.loaded);
      });
      xhr.send(formData);
    });
  }
}
