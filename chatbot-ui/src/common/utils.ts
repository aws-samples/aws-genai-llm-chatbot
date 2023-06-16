import { Auth, Signer } from 'aws-amplify';

export class Utils {
  static classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
  }

  static generateUUID() {
    if (crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    if (crypto && crypto.getRandomValues) {
      console.log('crypto.randomUUID is not available using crypto.getRandomValues');

      return ('' + [1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (ch) => {
        let c = Number(ch);
        return (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16);
      });
    }

    console.log('crypto is not available');
    let date1 = new Date().getTime();
    let date2 = (typeof performance !== 'undefined' && performance.now && performance.now() * 1000) || 0;

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16;
      if (date1 > 0) {
        r = (date1 + r) % 16 | 0;
        date1 = Math.floor(date1 / 16);
      } else {
        r = (date2 + r) % 16 | 0;
        date2 = Math.floor(date2 / 16);
      }

      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  static delay(delay: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
  }

  static async signRequest({ url, method, service, region, idToken, data }: { url: string; method: string; service: string; region: string; idToken: string; data?: string }) {
    const currentCredentials = await Auth.currentCredentials();
    const essentialCredentials = Auth.essentialCredentials(currentCredentials);

    return Signer.sign(
      {
        method,
        url,
        headers: {
          idtoken: idToken,
          'Content-Type': 'application/json',
        },
        data,
      },
      {
        secret_key: essentialCredentials.secretAccessKey,
        access_key: essentialCredentials.accessKeyId,
        session_token: essentialCredentials.sessionToken,
      },
      { region, service },
    );
  }
}
