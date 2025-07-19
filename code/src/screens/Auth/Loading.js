import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useLinkTo, useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import {isEmpty, isUndefined} from 'lodash';
import { Box, Center, Heading, Progress, VStack } from 'native-base';
import React from 'react';
import { checkVersion } from 'react-native-check-version';
import { BrowseCategoryContext, LanguageContext, LibraryBranchContext, LibrarySystemContext, SystemMessagesContext, ThemeContext, UserContext } from '../../context/initialContext';
import { createGlueTheme } from '../../themes/theme';
import { getLanguageDisplayName, getTermFromDictionary, getTranslatedTermsForUserPreferredLanguage, translationsLibrary } from '../../translations/TranslationService';
import { getCatalogStatus, getLibraryInfo, getLibraryLanguages, getLibraryLinks, getSystemMessages } from '../../util/api/library';
import { getLocationInfo, getSelfCheckSettings } from '../../util/api/location';
import { fetchNotificationHistory, getAppPreferencesForUser, getLinkedAccounts, refreshProfile } from '../../util/api/user';
import { GLOBALS } from '../../util/globals';
import { LIBRARY, reloadBrowseCategories } from '../../util/loadLibrary';
import { getBrowseCategoryListForUser, PATRON } from '../../util/loadPatron';
import { CatalogOffline } from './CatalogOffline';
import { ForceLogout } from './ForceLogout';

import { logDebugMessage, logInfoMessage, logWarnMessage, logErrorMessage } from '../../util/logging.js';

const prefix = Linking.createURL('/');

Notifications.setNotificationHandler({
     handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
     }),
});

export const LoadingScreen = () => {
     const linkingUrl = Linking.useURL();
     const linkTo = useLinkTo();
     const navigation = useNavigation();
     const queryClient = useQueryClient();
     const isFocused = useIsFocused();
     //const state = useNavigationState((state) => state);
     const [progress, setProgress] = React.useState(0);
     const [isReloading, setIsReloading] = React.useState(false);
     const [hasError, setHasError] = React.useState(false);
     const [hasUpdate, setHasUpdate] = React.useState(false);
     const [incomingUrl, setIncomingUrl] = React.useState('');
     const [hasIncomingUrlChanged, setIncomingUrlChanged] = React.useState(false);

     const { user, updateUser, accounts, updateLinkedAccounts, cards, updateLibraryCards, updateAppPreferences, notificationHistory, updateNotificationHistory, updateInbox } = React.useContext(UserContext);
     const { library, updateLibrary, updateMenu, updateCatalogStatus, catalogStatus, catalogStatusMessage } = React.useContext(LibrarySystemContext);
     const { location, updateLocation, updateScope, updateEnableSelfCheck, updateSelfCheckSettings } = React.useContext(LibraryBranchContext);
     const { category, updateBrowseCategories, updateBrowseCategoryList, updateMaxCategories } = React.useContext(BrowseCategoryContext);
     const { language, updateLanguage, updateLanguages, updateDictionary, dictionary, languageDisplayName, updateLanguageDisplayName, languages } = React.useContext(LanguageContext);
     const { systemMessages, updateSystemMessages } = React.useContext(SystemMessagesContext);
     const { theme, updateTheme, updateColorMode } = React.useContext(ThemeContext);

     const [loadingText, setLoadingText] = React.useState('');
     const [loadingTheme, setLoadingTheme] = React.useState(true);

     const numSteps = 14;

      React.useEffect(() => {
          const unsubscribe = navigation.addListener('focus', async () => {
               // The screen is focused
               logDebugMessage('The screen is focused.');
               setIsReloading(true);
               setProgress(0);
               queryClient.queryCache.clear();
               //navigation.dispatch(StackActions.popToTop());
               try {
                    await AsyncStorage.getItem('@colorMode').then(async (mode) => {
                         if (mode === 'light' || mode === 'dark') {
                              updateColorMode(mode);
                         } else {
                              updateColorMode('light');
                         }
                    });
               } catch (e) {
                    // something went wrong (or the item didn't exist yet in storage)
                    // so just set it to the default: light
                    updateColorMode('light');
               }

               await createGlueTheme(LIBRARY.url).then((result) => {
                    updateTheme(result);
                    setLoadingTheme(false);
               });
          });

          return unsubscribe;
     }, [navigation]);

     /**
      * Load information needed to display the interface. These are done sequentially since some calls may rely on previous data.
      * This is done by controlling when each query is enabled.
      */

     /**
      * First check to see if the catalog is online and check to see if offline mode is active.
      */
     const { isSuccess: catalogStatusSuccess, status: catalogStatusQueryStatus, data: catalogStatusQuery } = useQuery(['catalog_status', LIBRARY.url], () => getCatalogStatus(LIBRARY.url), {
          enabled: !!LIBRARY.url && !loadingTheme,
          onSuccess: (data) => {
               updateCatalogStatus(data);
               if (isUndefined(LIBRARY.appSettings.loadingMessageType) || LIBRARY.appSettings.loadingMessageType == 0) {
                    setLoadingText(getTermFromDictionary(language ?? 'en', 'loading_1'));
               }else if (LIBRARY.appSettings.loadingMessageType == 1) {
                    setLoadingText('Loading Translations');
               }else if (LIBRARY.appSettings.loadingMessageType == 2) {
                    setLoadingText(LIBRARY.appSettings.loadingMessage);
               }
               setProgress(progress + (100 / numSteps));
          },
          onError: () => {
               setHasError(true);
          }
     });

     /**
       * Preload parameterized translations for use on holds and checkouts pages. This does not halt loading LiDA.
       */
     const { isSuccess: translationQuerySuccess, status: translationQueryStatus, data: translationQuery } = useQuery(['active_language', PATRON.language, LIBRARY.url], () => getTranslatedTermsForUserPreferredLanguage(PATRON.language ?? 'en', LIBRARY.url), {
          enabled: !!LIBRARY.url && catalogStatusSuccess,
          onSuccess: (data) => {
               setProgress(progress + (100 / numSteps));
               updateDictionary(translationsLibrary);
               if (LIBRARY.appSettings.loadingMessageType == 1) {
                    setLoadingText('Loading Languages');
               }
          },
          onError: () => {
               setHasError(true);
          }
     });

     const { isSuccess: languagesQuerySuccess, status: languagesQueryStatus, data: languagesQuery } = useQuery(['languages', LIBRARY.url], () => getLibraryLanguages(LIBRARY.url), {
          enabled: hasError === false && catalogStatusSuccess,
          onSuccess: (data) => {
               setProgress(progress + (100 / numSteps));
               updateLanguages(data);
               if (LIBRARY.appSettings.loadingMessageType == 1) {
                    setLoadingText('Loading Library Information');
               }
          },
          onError: () => {
               setHasError(true);
          }
     });

     React.useEffect(() => {
          const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
               const url = response?.notification?.request?.content?.data?.url ?? prefix;
               if (url !== incomingUrl) {
                    logInfoMessage('Incoming url changed');
                    logDebugMessage('OLD > ' + incomingUrl);
                    logDebugMessage('NEW > ' + url);
                    setIncomingUrl(response?.notification?.request?.content?.data?.url ?? prefix);
                    setIncomingUrlChanged(true);
               } else {
                    setIncomingUrlChanged(false);
               }
          });

          return () => {
               responseListener.remove();
          };
     }, []);

     const { isSuccess: librarySystemQuerySuccess, status: librarySystemQueryStatus, data: librarySystemQuery } = useQuery(['library_system', LIBRARY.url], () => getLibraryInfo(LIBRARY.url), {
          enabled: hasError === false && languagesQuerySuccess,
          onSuccess: (data) => {
               setProgress(progress + (100 / numSteps));
               updateLibrary(data);
               if (LIBRARY.appSettings.loadingMessageType == 1) {
                    setLoadingText('Loading User Information');
               }
          },
          onError: () => {
               setHasError(true);
          }
     });

     const { isSuccess: userQuerySuccess, status: userQueryStatus, data: userQuery } = useQuery(['user', LIBRARY.url, 'en'], () => refreshProfile(LIBRARY.url), {
          enabled: hasError === false && librarySystemQuerySuccess,
          onSuccess: (data) => {
               logInfoMessage('User Profile refreshed');
               logDebugMessage(data);
               if (isUndefined(data) || isEmpty(data)) {
                    setHasError(true);
               } else {
                    if (data.success === false || data.success === 'false') {
                         setHasError(true);
                    } else {
                         setProgress(progress + (100 / numSteps));
                         updateUser(data);
                         updateLanguage(data.interfaceLanguage ?? 'en');
                         updateLanguageDisplayName(getLanguageDisplayName(data.interfaceLanguage ?? 'en', languages));
                         PATRON.language = data.interfaceLanguage ?? 'en';
                    }
               }
               if (LIBRARY.appSettings.loadingMessageType == 1) {
                    setLoadingText('Loading Menu');
               }
          },
          onError: () => {
               setHasError(true);
          }
     });

     const { isSuccess: libraryLinksQuerySuccess, status: libraryLinksQueryStatus, data: libraryLinksQuery } = useQuery(['library_links', LIBRARY.url], () => getLibraryLinks(LIBRARY.url), {
          enabled: hasError === false && userQuerySuccess,
          onSuccess: (data) => {
               setProgress(progress + (100 / numSteps));
               updateMenu(data);
               if (LIBRARY.appSettings.loadingMessageType == 1) {
                    setLoadingText('Loading Browse Categories');
               }
          },
          onError: () => {
               setHasError(true);
          }
     });

     const { isSuccess: browseCategoryQuerySuccess, status: browseCategoryQueryStatus, data: browseCategoryQuery } = useQuery(['browse_categories', LIBRARY.url, 'en', false], () => reloadBrowseCategories(5, LIBRARY.url), {
          enabled: hasError === false && libraryLinksQuerySuccess,
          onSuccess: (data) => {
               setProgress(progress + (100 / numSteps));
               updateBrowseCategories(data);
               updateMaxCategories(5);
               if (LIBRARY.appSettings.loadingMessageType == 1) {
                    setLoadingText('Loading Browse Category List');
               }
          },
          onError: () => {
               setHasError(true);
          }
     });

     const { isSuccess: browseCategoryListQuerySuccess, status: browseCategoryListQueryStatus, data: browseCategoryListQuery } = useQuery(['browse_categories_list', LIBRARY.url, 'en'], () => getBrowseCategoryListForUser(LIBRARY.url), {
          enabled: hasError === false && browseCategoryQuerySuccess,
          onSuccess: (data) => {
               setProgress(progress + (100 / numSteps));
               if (isUndefined(LIBRARY.appSettings.loadingMessageType) || LIBRARY.appSettings.loadingMessageType == 0) {
                    setLoadingText(getTermFromDictionary(language ?? 'en', 'loading_2'));
               }else if (LIBRARY.appSettings.loadingMessageType == 1) {
                    setLoadingText('Loading Branch Information');
               }
               updateBrowseCategoryList(data);
          },
          onError: () => {
               setHasError(true);
          }
     });

     const { isSuccess: libraryBranchQuerySuccess, status: libraryBranchQueryStatus, data: libraryBranchQuery } = useQuery(['library_location', LIBRARY.url, 'en'], () => getLocationInfo(LIBRARY.url), {
          enabled: hasError === false && browseCategoryListQuerySuccess,
          onSuccess: (data) => {
               setProgress(progress + (100 / numSteps));
               updateLocation(data);
               if (LIBRARY.appSettings.loadingMessageType == 1) {
                    setLoadingText('Loading Self Check Information');
               }
          },
          onError: () => {
               setHasError(true);
          }
     });

     const { isSuccess: selfCheckQuerySuccess, status: selfCheckQueryStatus, data: selfCheckQuery } = useQuery(['self_check_settings', LIBRARY.url, 'en'], () => getSelfCheckSettings(LIBRARY.url), {
          enabled: hasError === false && libraryBranchQuerySuccess,
          onSuccess: (data) => {
               setProgress(progress + (100 / numSteps));
               if (LIBRARY.appSettings.loadingMessageType == 1) {
                    setLoadingText('Loading Linked Account');
               }
               if (data.success) {
                    updateEnableSelfCheck(data.settings?.isEnabled ?? false);
                    updateSelfCheckSettings(data.settings);
               } else {
                    updateEnableSelfCheck(false);
               }
          },
          onError: () => {
               setHasError(true);
          }

     });

     const { isSuccess: linkedAccountQuerySuccess, status: linkedAccountQueryStatus, data: linkedAccountQuery } = useQuery(['linked_accounts', user ?? [], cards ?? [], LIBRARY.url, 'en'], () => getLinkedAccounts(user ?? [], cards ?? [], library.barcodeStyle, LIBRARY.url, 'en'), {
          enabled: hasError === false && selfCheckQuerySuccess,
          onSuccess: (data) => {
               setProgress(progress + (100 / numSteps));
               updateLinkedAccounts(data.accounts);
               updateLibraryCards(data.cards);
               setIsReloading(false);
               if (LIBRARY.appSettings.loadingMessageType == 1) {
                    setLoadingText('Loading System Message Information');
               }
          },
          onError: () => {
               setHasError(true);
          }
     });

     const { isSuccess: systemMessagesQuerySuccess, status: systemMessagesQueryStatus, data: systemMessagesQuery } = useQuery(['system_messages', LIBRARY.url], () => getSystemMessages(library.libraryId, location.locationId, LIBRARY.url), {
          enabled: hasError === false && linkedAccountQuerySuccess,
          onSuccess: (data) => {
               setProgress(progress + (100 / numSteps));
               updateSystemMessages(data);
               setIsReloading(false);
               if (LIBRARY.appSettings.loadingMessageType == 1) {
                    setLoadingText('Loading Application Preferences');
               }
          },
          onError: () => {
               setHasError(true);
          }
     });

     const { isSuccess: appPreferencesQuerySuccess, status: appPreferencesQueryStatus, data: appPreferencesQuery } = useQuery(['app_preferences', LIBRARY.url], () => getAppPreferencesForUser(LIBRARY.url, 'en'), {
          enabled: hasError === false && systemMessagesQuerySuccess,
          onSuccess: (data) => {
               updateAppPreferences(data);
               setProgress(progress + (100 / numSteps));
               setIsReloading(false);
               if (LIBRARY.appSettings.loadingMessageType == 1) {
                    setLoadingText('Loading Notification History');
               }
          },
          onError: () => {
               setHasError(true);
          }
     });

     const { isSuccess: notificationHistoryQuerySuccess, status: notificationHistoryQueryStatus, data: notificationHistoryQuery } = useQuery(['notification_history'], () => fetchNotificationHistory(1, 20, true, library.baseUrl, 'en'), {
          enabled: hasError === false && appPreferencesQuerySuccess,
          onSuccess: (data) => {
               setProgress(progress + (100 / numSteps));
               updateNotificationHistory(data);
               updateInbox(data?.inbox ?? []);
               setIsReloading(false);
          },
          onError: () => {
               setHasError(true);
          }
     });

     if (hasError) {
          return <ForceLogout />;
     }

     if (catalogStatus > 0) {
          // catalog is offline
          return <CatalogOffline />;
     }

     if (
          (isReloading && librarySystemQueryStatus === 'loading') ||
          catalogStatusQueryStatus === 'loading' ||
          userQueryStatus === 'loading' ||
          browseCategoryQueryStatus === 'loading' ||
          browseCategoryListQueryStatus === 'loading' ||
          languagesQueryStatus === 'loading' ||
          libraryBranchQueryStatus === 'loading' ||
          linkedAccountQueryStatus === 'loading' ||
          systemMessagesQueryStatus === 'loading' ||
          appPreferencesQueryStatus === 'loading' ||
          notificationHistoryQueryStatus === 'loading'
     ) {
          return (
               <Center flex={1} px="3" w="100%">
                    <Box w="90%" maxW="400">
                         <VStack>
                              <Heading pb={5} color="primary.500" fontSize="md">
                                   {loadingText}
                              </Heading>
                              <Progress size="lg" value={progress} colorScheme="primary" />
                         </VStack>
                    </Box>
               </Center>
          );
     }

     if (
          (!isReloading && librarySystemQueryStatus === 'success') ||
          catalogStatusQueryStatus === 'success' ||
          userQueryStatus === 'success' ||
          browseCategoryQueryStatus === 'success' ||
          browseCategoryListQueryStatus === 'success' ||
          languagesQueryStatus === 'success' ||
          libraryBranchQueryStatus === 'success' ||
          linkedAccountQueryStatus === 'success' ||
          systemMessagesQueryStatus === 'success' ||
          appPreferencesQueryStatus === 'success' ||
          notificationHistoryQueryStatus === 'success'
     ) {
          if (hasIncomingUrlChanged) {
               let url = decodeURIComponent(incomingUrl).replace(/\+/g, ' ');
               url = url.replace('aspen-lida://', prefix);
               logDebugMessage('incomingUrl > ' + url);
               setIncomingUrlChanged(false);
               try {
                    logDebugMessage('Trying to open screen based on incomingUrl...');
                    Linking.openURL(url);
               } catch (e) {
                    logErrorMessage("Error opening incoming url");
                    logErrorMessage(e);
               }
          } else if (linkingUrl) {
               if (linkingUrl !== prefix && linkingUrl !== incomingUrl) {
                    setIncomingUrl(linkingUrl);
                    logDebugMessage('Updated incoming url');
                    const { hostname, path, queryParams, scheme } = Linking.parse(linkingUrl);
                    logDebugMessage('linkingUrl > ' + linkingUrl);
                    logDebugMessage(`Linked to app with hostname: ${hostname}, path: ${path}, scheme: ${scheme} and data: ${JSON.stringify(queryParams)}`);
                    try {
                         if (scheme !== 'exp') {
                              logDebugMessage('Trying to open screen based on linkingUrl...');
                              const url = linkingUrl.replace('aspen-lida://', prefix);
                              logDebugMessage('url > ' + url);
                              linkTo('/' + url);
                         } else {
                              if (path) {
                                   logDebugMessage('Trying to open screen based on linkingUrl to Expo app...');
                                   let url = '/' + path;
                                   if (!isEmpty(queryParams)) {
                                        const params = new URLSearchParams(queryParams);
                                        const str = params.toString();
                                        url = url + '?' + str + '&url=' + library.baseUrl;
                                   }
                                   logDebugMessage('url > ' + url);
                                   logDebugMessage('linkingUrl > ' + linkingUrl);
                                   linkTo('/' + url);
                              }
                         }
                    } catch (e) {
                         logErrorMessage("Error resolving deep link");
                         logErrorMessage(e);
                    }
               }
          }

          navigation.navigate('DrawerStack', {
               user: user,
               library: library,
               location: location,
               prevRoute: 'LoadingScreen',
          });
     }
};

async function checkStoreVersion() {
     try {
          const version = await checkVersion({
               bundleId: GLOBALS.bundleId,
               currentVersion: GLOBALS.appVersion,
          });
          if (version.needsUpdate) {
               return {
                    needsUpdate: true,
                    url: version.url,
                    latest: version.version,
               };
          }
     } catch (e) {
          logErrorMessage("Error checking store version");
          logErrorMessage(e);
     }

     return {
          needsUpdate: false,
          url: null,
          latest: GLOBALS.appVersion,
     };
}
