import { create } from 'apisauce';
import _ from 'lodash';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
// custom components and helper files
import { popAlert, popToast } from '../components/loadError';
import { createAuthTokens, getHeaders, postData, problemCodeMap } from './apiAuth';
import { GLOBALS } from './globals';
import { getTermFromDictionary } from '../translations/TranslationService';

import { logDebugMessage, logInfoMessage, logWarnMessage, logErrorMessage } from '../util/logging.js';

// complete the action on the item, i.e. checkout, hold, or view sample
export async function completeAction(id, actionType, patronId, formatId = '', sampleNumber = '', pickupBranch = '', sublocation = '', rememberPickupLocation = '', url, volumeId = '', holdType = '', holdNotificationPreferences, variationId = '', bibId = '') {
     logDebugMessage("Completing action " + actionType);
     const recordId = id.split(':');
     const source = recordId[0];
     let itemId = recordId[1];
     if (recordId[1] === 'kindle') {
          itemId = recordId[2];
     }

     let patronProfile;
     try {
          const tmp = await AsyncStorage.getItem('@patronProfile');
          patronProfile = JSON.parse(tmp);
     } catch (e) {
          logErrorMessage('Unable to fetch patron profile in grouped work from async storage');
          logErrorMessage(e);
     }

     if (actionType.includes('checkout')) {
          return await checkoutItem(url, itemId, source, patronId);
     } else if (actionType.includes('hold')) {
          if (volumeId) {
               return await placeHold(url, itemId, source, patronId, pickupBranch, sublocation, rememberPickupLocation, volumeId, holdType, id, holdNotificationPreferences);
          } else if (_.isObject(patronProfile)) {
               if (!patronProfile.overdriveEmail && patronProfile.promptForOverdriveEmail === 1 && source === 'overdrive') {
                    const getPromptForOverdriveEmail = [];
                    getPromptForOverdriveEmail['getPrompt'] = true;
                    getPromptForOverdriveEmail['itemId'] = itemId;
                    getPromptForOverdriveEmail['source'] = source;
                    getPromptForOverdriveEmail['patronId'] = patronId;
                    getPromptForOverdriveEmail['overdriveEmail'] = patronProfile.overdriveEmail;
                    getPromptForOverdriveEmail['promptForOverdriveEmail'] = patronProfile.promptForOverdriveEmail;
                    return getPromptForOverdriveEmail;
               }
          } else {
               return await placeHold(url, itemId, source, patronId, pickupBranch, sublocation, rememberPickupLocation, volumeId, holdType, id, holdNotificationPreferences, variationId);
          }
     } else if (actionType.includes('sample')) {
          return await overDriveSample(url, formatId, itemId, sampleNumber);
     }
}

/**
 * Checkout item to patron
 *
 * Parameters:
 * <ul>
 *     <li>itemId - the id for the record</li>
 *     <li>source - the source of the item, i.e. ils, hoopla, overdrive. If left empty, Aspen assumes ils.</li>
 *     <li>patronId - the id for the patron</li>
 * </ul>
 * @param {string} url
 * @param {number} itemId
 * @param {string} source
 * @param {number} patronId
 * @param {string} barcode
 * @param {string} locationId
 * @param {string} barcodeType
 **/
export async function checkoutItem(url, itemId, source, patronId, barcode = '', locationId = '', barcodeType) {
     const postBody = await postData();
     const api = create({
          baseURL: url + '/API',
          timeout: GLOBALS.timeoutAverage,
          headers: getHeaders(true),
          auth: createAuthTokens(),
          params: {
               itemId,
               itemSource: source,
               userId: patronId,
               locationId,
               barcode,
               barcodeType,
          },
     });
     const response = await api.post('/UserAPI?method=checkoutItem', postBody);
     if (response.ok) {
          const responseData = response.data;
          // reload patron data in the background
          //await getCheckedOutItems(url);

          return responseData.result;
     } else {
          popToast(getTermFromDictionary('en', 'error_no_server_connection'), getTermFromDictionary('en', 'error_no_library_connection'), 'error');
          logErrorMessage("No response from server while checking out item");
          logErrorMessage(response);
     }
}

/**
 * Place hold on item for patron
 *
 * Parameters:
 * <ul>
 *     <li>itemId - the id for the record</li>
 *     <li>source - the source of the item, i.e. ils, hoopla, overdrive. If left empty, Aspen assumes ils.</li>
 *     <li>patronId - the id for the patron</li>
 *     <li>pickupBranch - the location id for where the hold will be picked up at</li>
 * </ul>
 * @param {string} url
 * @param {number} itemId
 * @param {string} source
 * @param {number} patronId
 * @param {string} pickupBranch
 * @param {string} volumeId
 * @param {string} holdType
 * @param {string} recordId
 * @param {array} holdNotificationPreferences
 * @param {string} variationId
 * @param {string} bibId
 **/
export async function placeHold(url, itemId, source, patronId, pickupBranch, sublocation = '', rememberPickupLocation = '', volumeId = '', holdType = '', recordId = '', holdNotificationPreferences = null, variationId = null, bibId = null) {
     let id = itemId;
     if (variationId) {
          id = variationId;
          holdType = 'item';
     }
     if (volumeId && itemId) {
          if(holdType === 'item') {
               holdType = 'volume';
          }
     }

     const setParams = {
          itemId: id,
          itemSource: source,
          userId: patronId,
          pickupBranch,
          pickupSublocation: sublocation,
          volumeId: volumeId ?? '',
          sublocation: sublocation,
          holdType,
          recordId,
          bibId,
          rememberHoldPickupLocation: rememberPickupLocation ?? "",
     };
     logDebugMessage("Placing hold");
     logDebugMessage(setParams);

     if (holdNotificationPreferences) {
          if (holdNotificationPreferences.emailNotification === true) {
               _.assign(setParams, {
                    emailNotification: 'on',
               });
          }

          if (holdNotificationPreferences.phoneNotification === true) {
               _.assign(setParams, {
                    phoneNotification: 'on',
               });
               if (holdNotificationPreferences.phoneNumber && holdNotificationPreferences.phoneNumber.length > 0) {
                    _.assign(setParams, {
                         phoneNumber: holdNotificationPreferences.phoneNumber,
                    });
               }
          }

          if (holdNotificationPreferences.smsNotification === true) {
               _.assign(setParams, {
                    smsNotification: 'on',
               });
               if (holdNotificationPreferences.smsNumber && holdNotificationPreferences.smsNumber.length > 0) {
                    if (holdNotificationPreferences.smsCarrier && holdNotificationPreferences.smsCarrier !== -1) {
                         _.assign(setParams, {
                              smsCarrier: holdNotificationPreferences.smsCarrier,
                              smsNumber: holdNotificationPreferences.smsNumber,
                         });
                    }
               }
          }
     }

     const postBody = await postData();
     const api = create({
          baseURL: url + '/API',
          timeout: GLOBALS.timeoutAverage,
          headers: getHeaders(true),
          auth: createAuthTokens(),
          params: setParams,
     });
     logDebugMessage("Placing Hold");
     logDebugMessage(setParams);
     const response = await api.post('/UserAPI?method=placeHold', postBody);
     if (response.ok) {
          logDebugMessage("Place Hold result");
          logDebugMessage(response.data.result);
          return response.data.result;
     } else {
          popToast(getTermFromDictionary('en', 'error_no_server_connection'), getTermFromDictionary('en', 'error_no_library_connection'), 'error');
          logErrorMessage("No server connection while placing hold");
          logErrorMessage(response);
     }
}

export async function overDriveSample(url, formatId, itemId, sampleNumber, language = 'en') {
     const postBody = await postData();
     const api = create({
          baseURL: url + '/API',
          timeout: GLOBALS.timeoutAverage,
          headers: getHeaders(true),
          auth: createAuthTokens(),
          params: {
               overDriveId: itemId,
               formatId,
               sampleNumber,
               itemSource: 'overdrive',
               isPreview: 'true',
          },
     });
     const response = await api.post('/UserAPI?method=viewOnlineItem', postBody);

     if (response.ok) {
          const result = response.data;
          const accessUrl = result.result.url;

          logDebugMessage("Response loading OverDrive Preview");
          logDebugMessage(response);

          await WebBrowser.openBrowserAsync(accessUrl)
               .then((res) => {
                    logDebugMessage("Response from opening browser for OverDrive Preview");
                    logDebugMessage(res);
               })
               .catch(async (err) => {
                    if (err.message === 'Another WebBrowser is already being presented.') {
                         try {
                              WebBrowser.dismissBrowser();
                              await WebBrowser.openBrowserAsync(accessUrl)
                                   .then((response) => {
                                        logDebugMessage("Response from reopening browser");
                                        logDebugMessage(response);
                                   })
                                   .catch(async (error) => {
                                        logWarnMessage('Unable to close previous browser session.');
                                   });
                         } catch (error) {
                              logErrorMessage('Error displaying browser for OverDrive Preview.');
                              logErrorMessage(error);
                         }
                    } else {
                         popToast(getTermFromDictionary('en', 'error_no_open_resource'), getTermFromDictionary('en', 'error_device_block_browser'), 'error');
                    }
               });
     } else {
          popToast(getTermFromDictionary('en', 'error_no_server_connection'), getTermFromDictionary('en', 'error_no_library_connection'), 'error');
          logErrorMessage("No server connection while getting OverDrive Preview");
          logErrorMessage(response);
     }
}

export async function openSideLoad(redirectUrl) {
     if (redirectUrl) {
          await WebBrowser.openBrowserAsync(redirectUrl)
               .then((res) => {
                    logDebugMessage("Response from opening side load");
                    logDebugMessage(res);
               })
               .catch(async (err) => {
                    if (err.message === 'Another WebBrowser is already being presented.') {
                         try {
                              WebBrowser.dismissBrowser();
                              await WebBrowser.openBrowserAsync(redirectUrl)
                                   .then((response) => {
                                        logDebugMessage("Response from reopening browser");
                                                                                logDebugMessage(response);
                                   })
                                   .catch(async (error) => {
                                        logWarnMessage('Unable to close previous browser session.');
                                        popToast(getTermFromDictionary('en', 'error_no_open_resource'), getTermFromDictionary('en', 'error_device_block_browser'), 'error');
                                   });
                         } catch (error) {
                              logErrorMessage('Tried to open again but still unable');
                              logErrorMessage(error);
                              popToast(getTermFromDictionary('en', 'error_no_open_resource'), getTermFromDictionary('en', 'error_device_block_browser'), 'error');
                         }
                    } else {
                         logWarnMessage('Unable to open browser window.');
                         popToast(getTermFromDictionary('en', 'error_no_open_resource'), getTermFromDictionary('en', 'error_device_block_browser'), 'error');
                    }
               });
     } else {
          popToast(getTermFromDictionary('en', 'error_no_open_resource'), getTermFromDictionary('en', 'error_no_valid_url'), 'error');
          logErrorMessage("No server connection while getting SideLoad to display");
          logErrorMessage(response);
     }
}

export async function getItemDetails(url, id, format) {
     const postBody = await postData();
     const api = create({
          baseURL: url + '/API',
          timeout: GLOBALS.timeoutAverage,
          headers: getHeaders(true),
          auth: createAuthTokens(),
          params: {
               recordId: id,
               format,
          },
     });
     const response = await api.post('/ItemAPI?method=getItemDetails', postBody);
     if (response.ok) {
          return response.data;
     } else {
          popToast(getTermFromDictionary('en', 'error_no_server_connection'), getTermFromDictionary('en', 'error_no_library_connection'), 'error');
          logErrorMessage("No server connection while getting Item Details");
          logErrorMessage(response);
     }
}

export async function submitVdxRequest(url, request) {
     const postBody = await postData();
     const api = create({
          baseURL: url + '/API',
          timeout: GLOBALS.timeoutAverage,
          headers: getHeaders(true),
          auth: createAuthTokens(),
          params: {
               title: request.title,
               author: request.author,
               publisher: request.publisher,
               isbn: request.isbn,
               maximumFeeAmount: request.maximumFeeAmount,
               acceptFee: request.acceptFee,
               pickupLocation: request.pickupLocation,
               catalogKey: request.catalogKey,
               oclcNumber: request.oclcNumber,
               note: request.note,
          },
     });
     const response = await api.post('/UserAPI?method=submitVdxRequest', postBody);
     if (response.ok) {
          if (response.data.result?.success === true) {
               popAlert(response.data.result.title, response.data.result.message, 'success');
               return response.data.result;
          } else {
               popAlert(response.data.title ?? 'Unknown Error', response.data.message, 'error');
               logErrorMessage("Error Submitting VDX Request");
               logErrorMessage(response.data);
               return response.data;
          }
     } else {
          const problem = problemCodeMap(response.problem);
          popAlert(problem.title, problem.message, 'error');
          logErrorMessage("Error Submitting VDX Request");
          logErrorMessage(response);
     }
}

export async function submitLocalIllRequest(url, request) {
     const postBody = await postData();
     let params = {
        //title: request.title,
        acceptFee: request.acceptFee,
        pickupLocation: request.pickupLocation,
        catalogKey: request.catalogKey,
        volumeId: request.volumeId,
        note: request.note,
     }
     const api = create({
          baseURL: url + '/API',
          timeout: GLOBALS.timeoutAverage,
          headers: getHeaders(true),
          auth: createAuthTokens(),
          params: params,
     });
     logDebugMessage("Submitting Local ILL Request " + url + "/API/UserAPI?method=submitLocalIllRequest for catalog key " + request.catalogKey);
     logDebugMessage(params)
     const response = await api.post('/UserAPI?method=submitLocalIllRequest', postBody);
     if (response.ok) {
          logDebugMessage("Local ILL Response");
          logDebugMessage(response.data);
          if (response.data.result?.success === true) {
               popAlert(response.data.result.title, response.data.result.message, 'success');
               return response.data.result;
          } else {
               popAlert(response.data.title ?? 'Unknown Error', response.data.result.message, 'error');
               return response.data.result;
          }
     } else {
          logWarnMessage("Did not get a good response submitting local ILL request");
          const problem = problemCodeMap(response.problem);
          popAlert(problem.title, problem.message, 'error');
          logWarnMessage(response);
     }
}
