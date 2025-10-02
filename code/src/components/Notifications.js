import { create } from 'apisauce';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import _ from 'lodash';
import { Alert, CloseIcon, HStack, IconButton, Text, VStack } from 'native-base';
import React from 'react';
import { Platform } from 'react-native';
import { getTermFromDictionary } from '../translations/TranslationService';
import { dismissSystemMessage } from '../util/api/library';

// custom components and helper files
import { createAuthTokens, getHeaders, postData, problemCodeMap, stripHTML } from '../util/apiAuth';
import { GLOBALS } from '../util/globals';
import { popAlert, popToast } from './loadError';

import { logDebugMessage, logInfoMessage, logWarnMessage, logErrorMessage } from '../util/logging.js';

export async function registerForPushNotificationsAsync(url) {
     try {
          // For simulator
          if (!Device.isDevice) {
               logDebugMessage("Running on simulator - using development notification setup");
               const { status } = await Notifications.getPermissionsAsync();
               if (status === 'granted') {
                    return 'ExponentPushToken[simulator-test-token]';
               }
               return false;
          }

          // For real devices
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;

          // Only ask for permissions if not already granted
          if (existingStatus !== 'granted') {
               logDebugMessage("Requesting notification permissions...");
               // Call requestPermissionsAsync without any parameters
               const { status } = await Notifications.requestPermissionsAsync();
               finalStatus = status;
          }

          if (finalStatus !== 'granted') {
               logWarnMessage('Failed to get push notification permissions');
               return false;
          }

          // Create notification channels for Android
          if (Platform.OS === 'android') {
               await createChannelsAndCategories();
          }

          // Get the token
          const response = await Notifications.getExpoPushTokenAsync({
               projectId: Constants.expoConfig.extra.eas.projectId,
          });

          logDebugMessage('Got push token:', response.data);
          return response.data;
     } catch (error) {
          logErrorMessage("Error in registerForPushNotificationsAsync:", error);
          return false;
     }
}

export async function savePushToken(url, pushToken) {
     let postBody = await postData();
     postBody.append('pushToken', pushToken);
     postBody.append('deviceModel', Device.modelName);
     const api = create({
          baseURL: url + '/API',
          timeout: GLOBALS.timeoutAverage,
          headers: getHeaders(true),
          auth: createAuthTokens(),
     });
     const response = await api.post('/UserAPI?method=saveNotificationPushToken', postBody);
     return response.ok;
}

export async function getPushToken(libraryUrl) {
     let postBody = await postData();
     const api = create({
          baseURL: libraryUrl + '/API',
          timeout: GLOBALS.timeoutAverage,
          headers: getHeaders(true),
          auth: createAuthTokens(),
     });
     const response = await api.post('/UserAPI?method=getNotificationPushToken', postBody);
     if (response.ok) {
          if (response.data.result.success) {
               return response.data.result.tokens;
          } else {
               return [];
          }
     } else {
          logWarnMessage("Could not retrieve push tokens");
          logWarnMessage(response);
          return [];
     }
}

export async function deletePushToken(libraryUrl, pushToken, shouldAlert = false) {
     let postBody = await postData();
     postBody.append('pushToken', pushToken);
     const api = create({
          baseURL: libraryUrl + '/API',
          timeout: GLOBALS.timeoutAverage,
          headers: getHeaders(true),
          auth: createAuthTokens(),
     });
     const response = await api.post('/UserAPI?method=deleteNotificationPushToken', postBody);
     return response.ok;
}

async function createNotificationChannelGroup(id, name, description = null) {
     if (Platform.OS === 'android') {
          Notifications.setNotificationChannelGroupAsync(`${id}`, {
               name: `${name}`,
               description: `${description}`,
          });
     }
}

async function getNotificationChannelGroup(group) {
     if (Platform.OS === 'android') {
          return Notifications.getNotificationChannelGroupAsync(`${group}`);
     }
     return false;
}

async function createNotificationChannel(id, name, groupId) {
     if (Platform.OS === 'android') {
          Notifications.setNotificationChannelAsync(`${id}`, {
               name: `${name}`,
               importance: Notifications.AndroidImportance.MAX,
               vibrationPattern: [0, 250, 250, 250],
               lightColor: '#FF231F7C',
               groupId: `${groupId}`,
               showBadge: true,
          });
     }
}

async function getNotificationChannel(channel) {
     if (Platform.OS === 'android') {
          return Notifications.getNotificationChannelAsync(`${channel}`);
     }
     return false;
}

async function deleteNotificationChannel(channel) {
     if (Platform.OS === 'android') {
          return Notifications.deleteNotificationChannelAsync(`${channel}`);
     }
     return false;
}

async function createNotificationCategory(id, name, button) {
     Notifications.setNotificationCategoryAsync(`${id}`, [
          {
               identifier: `${name}`,
               buttonTitle: `${button}`,
          },
     ]);
}

async function getNotificationCategory(category) {
     return Notifications.getNotificationCategoriesAsync();
}

async function deleteNotificationCategory(category) {
     return Notifications.deleteNotificationCategoryAsync(`${category}`);
}

export async function getNotificationPreferences(libraryUrl, pushToken) {
     let postBody = await postData();
     postBody.append('pushToken', pushToken);
     const api = create({
          baseURL: libraryUrl + '/API',
          timeout: GLOBALS.timeoutAverage,
          headers: getHeaders(true),
          auth: createAuthTokens(),
     });
     logDebugMessage("Loading notification preferences");
     const response = await api.post('/UserAPI?method=getNotificationPreferences', postBody);
     if (response.ok) {
          try {
               await createChannelsAndCategories();
          } catch (e) {
               logErrorMessage("Could not create channels and categories");
               logErrorMessage(e);
          }
          return response.data.result;
     } else {
          const problem = problemCodeMap(response.problem);
          popToast(problem.title, problem.message, 'error');
          logWarnMessage("Could not retrieve notification preferences");
          logWarnMessage(response);
          return false;
     }
}

export async function getNotificationPreference(url, pushToken, type) {
     let postBody = await postData();
     postBody.append('pushToken', pushToken);
     postBody.append('type', type);
     const api = create({
          baseURL: url + '/API',
          timeout: GLOBALS.timeoutAverage,
          headers: getHeaders(true),
          auth: createAuthTokens(),
          params: {
               type: type,
          },
     });
     logDebugMessage("Getting notification preference")
     const response = await api.post('/UserAPI?method=getNotificationPreference', postBody);
     if (response.ok) {
          if (response.data.result.success === true) {
               return response.data.result;
          } else {
               popAlert(response.data.result.title ?? 'Unknown Error', response.data.result.message, 'error');
               return false;
          }
     } else {
          const problem = problemCodeMap(response.problem);
          popToast(problem.title, problem.message, 'error');
          return false;
     }
}

export async function setNotificationPreference(url, pushToken, type, value, showToast = true) {
     let postBody = await postData();
     postBody.append('pushToken', pushToken);
     postBody.append('type', type);
     postBody.append('value', value);
     const api = create({
          baseURL: url + '/API',
          timeout: GLOBALS.timeoutAverage,
          headers: getHeaders(true),
          auth: createAuthTokens(),
          params: {
               type: type,
               value: value,
          },
     });
     const response = await api.post('/UserAPI?method=setNotificationPreference', postBody);
     return response.ok;
}

export async function createChannelsAndCategories() {
     logDebugMessage('Creating channels and categories for notifications...');
     const updatesChannelGroup = await getNotificationChannelGroup('updates');
     if (!updatesChannelGroup) {
          await createNotificationChannelGroup('updates', 'Updates');
     }

     const savedSearchChannel = await getNotificationChannel('savedSearch');
     if (!savedSearchChannel) {
          await createNotificationChannel('savedSearch', 'Saved Searches', 'updates');
     }

     const libraryAlertChannel = await getNotificationChannel('libraryAlert');
     if (!libraryAlertChannel) {
          await createNotificationChannel('libraryAlert', 'Library Alert', 'updates');
     }

     const accountAlertChannel = await getNotificationChannel('accountAlert');
     if (!accountAlertChannel) {
          await createNotificationChannel('accountAlert', 'Account Alert', 'updates');
     }

     const savedSearchCategory = await getNotificationCategory('savedSearch');
     if (!savedSearchCategory) {
          await createNotificationCategory('savedSearch', 'Saved Searches', 'View');
     }

     const libraryAlertCategory = await getNotificationCategory('libraryAlert');
     if (!libraryAlertCategory) {
          await createNotificationCategory('libraryAlert', 'Library Alert', 'Read More');
     }

     const accountAlertCategory = await getNotificationCategory('accountAlert');
     if (!accountAlertCategory) {
          await createNotificationCategory('accountAlert', 'Account Alert', 'View');
     }
}

/** status/colorScheme options: success, error, info, warning **/
export function showILSMessage(type, message, index = 0) {
     const formattedMessage = stripHTML(message);
     return (
          <Alert maxW="95%" status={type} colorScheme={type} mb={1} ml={2} key={index}>
               <HStack flexShrink={1} space={2} alignItems="center" justifyContent="space-between">
                    <HStack flexShrink={1} space={2} alignItems="center">
                         <Alert.Icon />
                         <Text fontSize="xs" fontWeight="medium" color="coolGray.800" maxW="90%">
                              {formattedMessage}
                         </Text>
                    </HStack>
               </HStack>
          </Alert>
     );
}

/** status/colorScheme options: success, error, info, warning **/
export const DisplayMessage = (props) => {
     return (
          <Alert status={props.type} colorScheme={props.type} mb={2}>
               <HStack flexShrink={1} space={5} alignItems="center" justifyContent="space-between" px={4}>
                    <Alert.Icon />
                    <Text fontSize="xs" fontWeight="medium" color="coolGray.800">
                         {props.message}
                    </Text>
               </HStack>
          </Alert>
     );
};

async function hideSystemMessage(allSystemMessages, currentMessageId, isDismissible, url) {
     let messages = allSystemMessages;
     // remove it from the array to hide it for the session
     messages = _.reject(messages, { id: currentMessageId });

     if (isDismissible === 1 || isDismissible === '1') {
          // send request to dismiss it with Discovery
          dismissSystemMessage(currentMessageId, url);
     }

     return messages;
}

export const DisplayAndroidEndOfSupportMessage = (props) => {
     const setIsOpen = props.setIsOpen;
     const language = props.language;
     return (
          <Alert maxW="100%" status="error" colorScheme="error" mb={3} index={-1}>
               <VStack space={2} flexShrink={1} w="100%">
                    <HStack flexShrink={1} alignItems="flex-start" space={2} justifyContent="space-between">
                         <HStack space={2} flexShrink={1} pr={3}>
                              <Text fontSize="sm" mb={-1}>
                                   {getTermFromDictionary(language, 'android_end_of_life')}
                              </Text>
                         </HStack>
                         <IconButton
                              mt={-2}
                              variant="unstyled"
                              _focus={{
                                   borderWidth: 0,
                              }}
                              icon={<CloseIcon size="3" />}
                              onPress={() => setIsOpen(false)}
                         />
                    </HStack>
               </VStack>
          </Alert>
     );
};
/** status/colorScheme options: success, error, info, warning **/
export const DisplaySystemMessage = (props) => {
     const queryClient = props.queryClient;
     const updateSystemMessages = props.updateSystemMessages;
     let style = props.style;
     let scheme = props.style;

     // return a custom alert if the system message style is 'none'
     if (props.style === '') {
          return (
               <Alert maxW="100%" status="info" backgroundColor="coolGray.200" mb={2} index={props.id}>
                    <VStack space={2} flexShrink={1} w="100%">
                         <HStack flexShrink={1} alignItems="flex-start" space={2} justifyContent="space-between">
                              <HStack space={2} flexShrink={1} pr={3}>
                                   <Text fontSize="sm" color="coolGray.800" mb={-1}>
                                        {props.message}
                                   </Text>
                              </HStack>
                              <IconButton
                                   onPress={async () => {
                                        await hideSystemMessage(props.all, props.id, props.dismissable, props.url).then((result) => {
                                             queryClient.setQueryData(['system_messages', props.url], result);
                                             updateSystemMessages(result);
                                        });
                                   }}
                                   mt={-2}
                                   variant="unstyled"
                                   _focus={{
                                        borderWidth: 0,
                                   }}
                                   icon={<CloseIcon size="3" />}
                                   _icon={{
                                        color: 'coolGray.600',
                                   }}
                              />
                         </HStack>
                    </VStack>
               </Alert>
          );
     }
     return (
          <Alert maxW="100%" status={style} colorScheme={scheme} mb={2} index={props.id}>
               <VStack space={2} flexShrink={1} w="100%">
                    <HStack flexShrink={1} alignItems="flex-start" space={2} justifyContent="space-between">
                         <HStack space={2} flexShrink={1} pr={3}>
                              <Text fontSize="sm" color="coolGray.800" mb={-1}>
                                   {props.message}
                              </Text>
                         </HStack>
                         <IconButton
                              onPress={async () => {
                                   await hideSystemMessage(props.all, props.id, props.dismissable, props.url).then((result) => {
                                        queryClient.setQueryData(['system_messages', props.url], result);
                                        updateSystemMessages(result);
                                   });
                              }}
                              mt={-2}
                              variant="unstyled"
                              _focus={{
                                   borderWidth: 0,
                              }}
                              icon={<CloseIcon size="3" />}
                              _icon={{
                                   color: 'coolGray.600',
                              }}
                         />
                    </HStack>
               </VStack>
          </Alert>
     );
};
