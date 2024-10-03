export class Utils {
  static isDevelopment() {
    return import.meta.env.MODE === "development";
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  static isFunction(value: unknown): value is Function {
    return typeof value === "function";
  }

  static classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
  }

  static generateUUID() {
    if (crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    if (crypto && crypto.getRandomValues) {
      console.log(
        "crypto.randomUUID is not available using crypto.getRandomValues"
      );

      return ("" + [1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(
        /[018]/g,
        (ch) => {
          const c = Number(ch);
          return (
            c ^
            (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
          ).toString(16);
        }
      );
    }

    console.log("crypto is not available");
    let date1 = new Date().getTime();
    let date2 =
      (typeof performance !== "undefined" &&
        performance.now &&
        performance.now() * 1000) ||
      0;

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        let r = Math.random() * 16;
        if (date1 > 0) {
          r = (date1 + r) % 16 | 0;
          date1 = Math.floor(date1 / 16);
        } else {
          r = (date2 + r) % 16 | 0;
          date2 = Math.floor(date2 / 16);
        }

        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      }
    );
  }

  static delay(delay: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
  }

  static findElementInParents(element: HTMLElement | null, tagName: string) {
    let current: HTMLElement | null = element;
    while (current) {
      if (current.tagName === tagName) {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  }

  /* eslint-disable  @typescript-eslint/no-explicit-any */
  static getErrorMessage(error: any) {
    if (
      error.errors &&
      error.errors.length === 1 &&
      error.errors[0].originalError?.response?.status === 429
    ) {
      // Detect WAF throttling error. originalError is an AxiosError object
      return "Too many requests. Please try again later.";
    }
    if (error.errors) {
      return error.errors.map((e: any) => e.message).join(", ");
    }

    return "Unknown error";
  }
  /* eslint-enable  @typescript-eslint/no-explicit-any */

  static urlSearchParamsToRecord(
    params: URLSearchParams
  ): Record<string, string> {
    const record: Record<string, string> = {};

    for (const [key, value] of params.entries()) {
      record[key] = value;
    }

    return record;
  }

  static bytesToSize(bytes: number): string {
    const sizes: string[] = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

    if (bytes === 0) return "0 MB";
    const i: number = parseInt(
      Math.floor(Math.log(bytes) / Math.log(1024)).toString()
    );

    const sizeStr = i >= sizes.length ? "" : sizes[i];
    return Math.round(bytes / Math.pow(1024, i)) + " " + sizeStr;
  }

  static textEllipsis(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + "...";
  }

  static isValidURL(value: string) {
    if (value.length === 0 || value.indexOf(" ") !== -1) {
      return false;
    }

    const result = value.match(
      /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi
    );

    return result !== null;
  }
}
