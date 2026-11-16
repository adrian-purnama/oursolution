export interface GoogleConfigOutDto {
  /** Null when Google sign-in is not set up. */
  clientId: string | null;
  redirectUri: string;
}

export interface GoogleSignInInDto {
  /** The one-time code Google sent back to the callback page. */
  code: string;
  rememberMe?: boolean;
}

export interface GoogleSignInOutDto {
  email: string;
  jwt: string;
}
