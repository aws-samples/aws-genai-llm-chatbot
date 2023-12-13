import { FileUploadResult } from "../API";

export class FileUploader {
  upload(
    file: File,
    signature: FileUploadResult,
    onProgress: (uploaded: number) => void
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      console.log(signature);
      const fields = signature.fields!.replace("{", "").replace("}", "");
      for (let f in fields.split(",")) {
        const [k, v] = f.split("=");
        formData.append(k, v);
      }

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
