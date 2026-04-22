import { API_KEY_1, API_KEY_2, API_KEY_3, API_KEY_4, API_KEY_5 } from '@env';
import { create } from 'apisauce';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { decode } from 'html-entities';
import _ from 'lodash';
import { useEffect } from 'react';
import base64 from 'react-native-base64';
import { popToast } from '../components/loadError';
import { getTermFromDictionary } from '../translations/TranslationService';
import * as Sentry from '@sentry/react-native';

import { GLOBALS } from './globals';
import { logErrorMessage } from './logging';

// polyfill for base64 (required for authentication)
if (!global.btoa) {
     global.btoa = base64.encode;
}
if (!global.atob) {
     global.atob = base64.decode;
}

/**
 * Create authentication token to validate the API request to Aspen
 **/
export function createAuthTokens() {
     const tokens = {};
     tokens['username'] = makeNewSecret();
     tokens['password'] = makeNewSecret();
     return tokens;
}

/**
 * Create secure data body to send the patron login information to Aspen via POST
 **/
export async function postData() {
     const content = new FormData();
     try {
          const secretKey = await SecureStore.getItemAsync('secretKey');
          const userKey = await SecureStore.getItemAsync('userKey');
          content.append('username', userKey);
          content.append('password', secretKey);
     } catch (e) {
          console.log('Unable to fetch user keys to make POST request.');
          console.log(e);
     }
     return content;
}

export const UsePostData = () => {
     const content = new FormData();
     let secretKey = null;
     let userKey = null;
     useEffect(() => {
          async function GetPostData() {
               secretKey = await SecureStore.getItemAsync('secretKey');
               userKey = await SecureStore.getItemAsync('userKey');
          }

          GetPostData();
     }, []);

     content.append('username', userKey);
     content.append('password', secretKey);

     return content;
};

/**
 * Collect header information to send to Aspen
 *
 * Parameters:
 * <ul>
 *     <li>isPost - if request is POST type, set to true. Required for Aspen to see POST parameters.</li>
 * </ul>
 **/
export function getHeaders(isPost = false, language = 'en') {
     const headers = {};

     headers['User-Agent'] = 'Aspen LiDA ' + Device.modelName + ' ' + Device.osName + '/' + Device.osVersion;
     headers['Version'] = 'v' + GLOBALS.appVersion + ' ' + GLOBALS.appStage + ' [b' + GLOBALS.appBuild + '] p' + GLOBALS.appPatch;
     headers['LiDA-SessionID'] = GLOBALS.appSessionId;
     headers['LiDA-Slug'] = GLOBALS.slug;
     headers['Cache-Control'] = 'no-cache';
     headers['Preferred-Language'] = language;

     for(let index = 0; index < GLOBALS.extraHeaders.length; index++)
     {
          let header = GLOBALS.extraHeaders[index];
          Object.assign(headers, header);
     }

     if (isPost) {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
     }

     //console.log("Headers are ");
     //console.log(headers);
     return headers;
}

/**
 * Passes the logged-in user to a Discovery page
 * @param {string} url
 * @param {string} redirectTo
 * @param {string} userId
 * @param {string} backgroundColor
 * @param {string} textColor
 * @param id
 **/
export async function passUserToDiscovery(url, redirectTo, userId, backgroundColor, textColor, id =  null, additionalParams = null) {
     const postBody = await postData();
     const discovery = create({
          baseURL: url + '/API',
          timeout: GLOBALS.timeoutAverage,
          headers: getHeaders(true),
          auth: createAuthTokens(),
     });
     const response = await discovery.post('/UserAPI?method=prepareSharedSession', postBody);
     if (response.ok) {
          const sessionId = response?.data?.result?.session ?? null;

          const browserParams = {
               enableDefaultShareMenuItem: false,
               presentationStyle: 'automatic',
               showTitle: false,
               toolbarColor: backgroundColor,
               controlsColor: textColor,
               secondaryToolbarColor: backgroundColor,
          };

          if (sessionId && userId) {
               let accessUrl = url + '/Authentication/LiDA?init&session=' + sessionId + '&user=' + userId + '&goTo=' + redirectTo + '&id=' + id + '&minimalInterface=true';
               for (const key in additionalParams) {
                    if (Object.prototype.hasOwnProperty.call(additionalParams, key)) {
                         accessUrl += "&" + key + "=" + encodeURI(additionalParams[key]);
                    }
               }
               await WebBrowser.openBrowserAsync(accessUrl, browserParams)
                    .then((res) => {
                         console.log(res);
                         if (res.type === 'cancel' || res.type === 'dismiss') {
                              console.log('User closed or dismissed window.');
                              WebBrowser.dismissBrowser();
                              WebBrowser.coolDownAsync();
                         }
                    })
                    .catch(async (err) => {
                         if (err.message === 'Another WebBrowser is already being presented.') {
                              try {
                                   WebBrowser.dismissBrowser();
                                   WebBrowser.coolDownAsync();
                                   await WebBrowser.openBrowserAsync(accessUrl, browserParams)
                                        .then((response) => {
                                             console.log(response);
                                             if (response.type === 'cancel') {
                                                  console.log('User closed window.');
                                             }
                                        })
                                        .catch(async (error) => {
                                             console.log('Unable to close previous browser session.');
                                        });
                              } catch (error) {
                                   console.log('Really borked.');
                              }
                         } else {
                              popToast(getTermFromDictionary('en', 'error_no_open_resource'), getTermFromDictionary('en', 'error_device_block_browser'), 'error');
                              console.log(err);
                         }
                    });
          } else {
               // unable to validate the user
               popToast(getTermFromDictionary('en', 'error_no_open_resource'), getTermFromDictionary('en', 'error_device_block_browser'), 'error');
               console.log('unable to validate user');
          }
     } else {
          const error = getErrorMessage({ statusCode: response.status, problem: response.problem });
          popToast(error.title, error.message, 'error');
          console.log(response);
     }
}

/**
 * Generate a random pairing of current keys
 **/
function makeNewSecret() {
     let tokens = [API_KEY_1, API_KEY_2, API_KEY_3, API_KEY_4, API_KEY_5];
     if (!__DEV__) {
          tokens = [process.env.API_KEY_1, process.env.API_KEY_2, process.env.API_KEY_3, process.env.API_KEY_4, process.env.API_KEY_5];
     }
     const thisKey = _.sample(_.shuffle(tokens));
     if (thisKey === undefined) {
          console.log("Token was undefined, you must have a .env with tokens matching those on the greenhouse.");
     }
     return base64.encode(thisKey);
}

/**
 * Check the problem code sent to display appropriate error message
 **/
export function problemCodeMap(code) {
     switch (code) {
          case 'CLIENT_ERROR':
               return {
                    title: "There's been a glitch",
                    message: "We're not quite sure what went wrong. Try reloading the page or come back later.",
               };
          case 'SERVER_ERROR':
               return {
                    title: 'Something went wrong',
                    message: 'Looks like our server encountered an internal error or misconfiguration and was unable to complete your request. Please try again in a while.',
               };
          case 'TIMEOUT_ERROR':
               return {
                    title: 'Connection timed out',
                    message: 'Looks like the server is taking to long to respond, this can be caused by either poor connectivity or an error with our servers. Please try again in a while.',
               };
          case 'CONNECTION_ERROR':
               return {
                    title: 'Problem connecting',
                    message: 'Check your internet connection and try again.',
               };
          case 'NETWORK_ERROR':
               return {
                    title: 'Problem connecting',
                    message: 'Looks like our servers are currently unavailable. Please try again in a while.',
               };
          case 'CANCEL_ERROR':
               return {
                    title: 'Something went wrong',
                    message: "We're not quite sure what went wrong so the request to our server was cancelled. Please try again in awhile.",
               };
          default:
               return null;
     }
}

/**
 * Check Aspen Discovery response for valid data
 * <ul>
 *     <li>payload - The object returned from api instance</li>
 * </ul>
 * @param {object} payload
 **/
export function getResponseCode(payload) {
     if (payload.ok) {
          return {
               success: true,
               config: payload.config,
               data: payload.data,
          };
     } else {
          logErrorMessage(payload);
          const problem = problemCodeMap(payload.problem);
          return {
               success: false,
               config: payload.config,
               error: {
                    title: problem.title,
                    code: payload.problem,
                    message: problem.message + ' (' + payload.problem + ')',
               },
          };
     }
}

/**
 * Remove HTML from a string
 **/
export function stripHTML(string) {
     return string.replace(/(<([^>]+)>)/gi, '');
}

/**
 * Decode HTML entities in a string
 **/
export function decodeHTML(string) {
     return decode(string);
}

export function urldecode(str) {
     return decodeURIComponent(str.replace(/\+/g, ' '));
}

/**
 * Array of available endpoints into Aspen Discovery
 *
 **/

export const ENDPOINT = {
     user: {
          url: '/API/UserAPI?method=',
          isPost: true,
     },
     search: {
          url: '/API/SearchAPI?method=',
          isPost: false,
     },
     list: {
          url: '/API/ListAPI?method=',
          isPost: true,
     },
     work: {
          url: '/API/WorkAPI?method=',
          isPost: false,
     },
     item: {
          url: '/API/ItemAPI?method=',
          isPost: false,
     },
     fine: {
          url: '/API/FineAPI?method=',
          isPost: true,
     },
     system: {
          url: '/API/SystemAPI?method=',
          isPost: false,
     },
     translation: {
          url: '/API/SystemAPI?method=',
          isPost: false,
     },
     greenhouse: {
          url: '/API/GreenhouseAPI?method=',
          isPost: false,
     },
};

export const delay = (ms) => new Promise((res) => setTimeout(res, ms));

export function getErrorMessage({ statusCode = null, problem, sendToSentry = false }) {
     let errorDetails;
     if (problem) {
          switch (problem) {
               case "TIMEOUT_ERROR":
                    errorDetails = {
                         title: "Timeout Error (Client-side)",
                         message: "The request took too long to respond. Please check your connection and try again.",
                         code: "TIMEOUT_ERROR",
                    };
                    break;
               case "CONNECTION_ERROR":
                    errorDetails = {
                         title: "Connection Error (Client-side)",
                         message: "Unable to connect to the server. Please verify your internet connection.",
                         code: "CONNECTION_ERROR",
                    };
                    break;
               case "NETWORK_ERROR":
                    errorDetails = {
                         title: "Network Error (Client-side)",
                         message: "A network error occurred. Please try again or check your connection.",
                         code: "NETWORK_ERROR",
                    };
                    break;
               default:
                    errorDetails = {
                         title: "Unknown Error (Client-side)",
                         message: "Unknown error " + (statusCode ?? "UNKNOWN") + " occurred. Please try again or check your connection.",
                         code: problem,
                    };
                    break;
          }
     } else {
          switch (statusCode) {
               case 400:
                    errorDetails = {
                         title: "Bad Request (400)",
                         message: "The server could not understand your request. Please check your input and try again.",
                         code: 400,
                    };
                    break;
               case 401:
                    errorDetails = {
                         title: "Unauthorized (401)",
                         message: "You are not authorized to perform this action. Please log in.",
                         code: 401,
                    };
                    break;
               case 403:
                    errorDetails = {
                         title: "Forbidden (403)",
                         message: "You do not have permission to access this resource.",
                         code: 403,
                    };
                    break;
               case 404:
                    errorDetails = {
                         title: "Not Found (404)",
                         message: "The requested resource could not be found.",
                         code: 404,
                    };
                    break;
               case 405:
                    errorDetails = {
                         title: "Method Not Allowed (405)",
                         message: "The request method is not supported for this resource.",
                         code: 405,
                    };
                    break;
               case 408:
                    errorDetails = {
                         title: "Request Timeout (408)",
                         message: "The server timed out waiting for your request. Please try again.",
                         code: 408,
                    };
                    break;
               case 409:
                    errorDetails = {
                         title: "Conflict (409)",
                         message: "There was a conflict with your request. Please check and try again.",
                         code: 409,
                    };
                    break;
               case 410:
                    errorDetails = {
                         title: "Gone (410)",
                         message: "The requested resource is no longer available on the server.",
                         code: 410,
                    };
                    break;
               case 413:
                    errorDetails = {
                         title: "Payload Too Large (413)",
                         message: "The request is too large for the server to process.",
                         code: 413,
                    };
                    break;
               case 414:
                    errorDetails = {
                         title: "URI Too Long (414)",
                         message: "The requested URI is too long for the server to handle.",
                         code: 414,
                    };
                    break;
               case 415:
                    errorDetails = {
                         title: "Unsupported Media Type (415)",
                         message: "The server does not support the media type of the request.",
                         code: 415,
                    };
                    break;
               case 429:
                    errorDetails = {
                         title: "Too Many Requests (429)",
                         message: "You have sent too many requests in a given amount of time. Please slow down.",
                         code: 429,
                    };
                    break;
               case 500:
                    errorDetails = {
                         title: "Internal Server Error (500)",
                         message: "The server encountered an error. Please try again later.",
                         code: 500,
                    };
                    break;
               case 501:
                    errorDetails = {
                         title: "Not Implemented (501)",
                         message: "The server does not support the functionality required to fulfill the request.",
                         code: 501,
                    };
                    break;
               case 502:
                    errorDetails = {
                         title: "Bad Gateway (502)",
                         message: "Received an invalid response from the upstream server.",
                         code: 502,
                    };
                    break;
               case 503:
                    errorDetails = {
                         title: "Service Unavailable (503)",
                         message: "The server is currently unavailable. Please try again later.",
                         code: 503,
                    };
                    break;
               case 504:
                    errorDetails = {
                         title: "Gateway Timeout (504)",
                         message: "The server did not receive a timely response from the upstream server.",
                         code: 504,
                    };
                    break;
               case 505:
                    errorDetails = {
                         title: "HTTP Version Not Supported (505)",
                         message: "The server does not support the HTTP protocol version used in the request.",
                         code: 505,
                    };
                    break;
               case 507:
                    errorDetails = {
                         title: "Insufficient Storage (507)",
                         message: "The server is unable to store the representation needed to complete the request.",
                         code: 507,
                    };
                    break;
               default:
                    errorDetails = {
                         title: `Error (${statusCode ?? "UNKNOWN"})`,
                         message: "An unexpected error occurred. Please try again.",
                         code: statusCode ?? "UNKNOWN",
                    };
                    break;
          }
     }

     // Always send to Sentry unless in DEV environment
     if ((!__DEV__) || (__DEV__ && sendToSentry)) {
          Sentry.captureMessage(
               `[${errorDetails.title}] ${errorDetails.message}`,
               {
                    level: 'error',
                    extra: { code: errorDetails.code, problem, statusCode }
               }
          );
     }

     return errorDetails;
}
