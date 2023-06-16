import * as jose from 'jose';
import fetch from 'node-fetch';

const AWS_REGION = process.env.AWS_REGION || '';
const USER_POOL_ID = process.env.USER_POOL_ID || '';
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID || '';

export class CognitoAuth {
  private _jwks: { [kid: string]: Uint8Array | jose.KeyLike } | null = null;
  private _issuer: string;

  constructor() {
    this._issuer = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`;
  }

  async verify(token?: string) {
    if (!this._jwks) {
      await this.fetchJWKS();
    }

    if (!token) {
      return null;
    }

    const verificationResult = await this.getVerifiedToken(token);
    if (verificationResult && verificationResult.verified) {
      return verificationResult.payload;
    }

    return null;
  }

  private async fetchJWKS() {
    const url = `${this._issuer}/.well-known/jwks.json`;
    console.log(`fetchJWKS: ${url}`);

    const response = await fetch(url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jwksObj: any = await response.json();
    const jwks: { [key: string]: Uint8Array | jose.KeyLike } = {};

    for (const key of jwksObj.keys) {
      jwks[key.kid] = await jose.importJWK(key, key.alg);
    }

    this._jwks = jwks;
  }

  private async getVerifiedToken(token: string) {
    const { kid } = jose.decodeProtectedHeader(token);
    if (!this._jwks || !kid) {
      return null;
    }

    try {
      const result = await jose.jwtVerify(token, this._jwks[kid], {
        audience: USER_POOL_CLIENT_ID,
        issuer: this._issuer,
      });

      const payload = result.payload;
      if (result.payload.token_use !== 'id') {
        return null;
      }

      return {
        verified: true,
        payload,
      };
    } catch (e) {
      console.error(e);
    }

    return null;
  }
}
