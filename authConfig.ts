import { Configuration, PopupRequest } from "@azure/msal-browser";
import { AZURE_CONFIG, SCOPES } from "./constants";

export const msalConfig: Configuration = {
  auth: {
    clientId: AZURE_CONFIG.clientId,
    authority: AZURE_CONFIG.authority,
    redirectUri: AZURE_CONFIG.redirectUri,
    postLogoutRedirectUri: AZURE_CONFIG.redirectUri,
  },
  cache: {
    cacheLocation: "sessionStorage", 
    storeAuthStateInCookie: false,
  },
};

export const loginRequest: PopupRequest = {
  scopes: SCOPES,
  prompt: "select_account" // Forces account selection to help trigger the Admin Consent flow
};