import { FileUploadItem } from "./types";

export class FileUploader {
  upload(
    file: File,
    signature: FileUploadItem,
    onProgress: (uploaded: number) => void
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      Object.keys(signature.fields).forEach((key) => {
        formData.append(key, signature.fields[key]);
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
