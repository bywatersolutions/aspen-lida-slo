import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { create } from 'apisauce';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import {includes, isUndefined} from 'lodash';
import {
     Button,
     ButtonText,
     Center,
     FormControl,
     FormControlLabel,
     FormControlLabelText,
     Icon,
     Input,
     InputField, InputIcon,
     InputSlot,
     Pressable,
} from '@gluestack-ui/themed';
import React, { useRef } from 'react';

// custom components and helper files
import { AuthContext } from '../../components/navigation';
import { DisplayMessage } from '../../components/Notifications';
import { LanguageContext, LibrarySystemContext, ThemeContext } from '../../context/initialContext';
import { navigate } from '../../helpers/RootNavigator';
import { getTermFromDictionary } from '../../translations/TranslationService';
import { getCatalogStatus } from '../../util/api/library';
import { getLocationInfo } from '../../util/api/location';
import { loginToLiDA } from '../../util/api/user';
import { createAuthTokens, getHeaders, stripHTML } from '../../util/apiAuth';
import { GLOBALS } from '../../util/globals';
import { formatDiscoveryVersion, LIBRARY } from '../../util/loadLibrary';
import { PATRON } from '../../util/loadPatron';
import { ResetExpiredPin } from './ResetExpiredPin';

import { logDebugMessage, logInfoMessage, logWarnMessage } from '../../util/logging.js';

export const GetLoginForm = (props) => {
     const {theme, textColor, colorMode} = React.useContext(ThemeContext);
     const navigation = useNavigation();
     const barcode = useRoute().params?.barcode ?? null;
     const [loading, setLoading] = React.useState(false);

     const [pinValidationRules, setPinValidationRules] = React.useState([]);
     const [expiredPin, setExpiredPin] = React.useState(false);
     const [resetToken, setResetToken] = React.useState('');
     const [userId, setUserId] = React.useState('');

     const [loginError, setLoginError] = React.useState(false);
     const [loginErrorMessage, setLoginErrorMessage] = React.useState('');

     // securely set and store key:value pairs
     const [valueUser, setUsername] = React.useState('');
     const [valueSecret, setPassword] = React.useState('');

     // show:hide data from password field
     const [showPassword, setShowPassword] = React.useState(false);
     const toggleShowPassword = () => setShowPassword(!showPassword);

     // make ref to move the user to next input field
     const passwordRef = useRef();
     const { signIn } = React.useContext(AuthContext);
     const { updateCatalogStatus, catalogStatus } = React.useContext(LibrarySystemContext);
     const { updateLanguage } = React.useContext(LanguageContext);
     const patronsLibrary = props.selectedLibrary;

     const { usernameLabel, passwordLabel, allowBarcodeScanner, allowCode39 } = props;

     React.useEffect(() => {
          const unsubscribe = navigation.addListener('focus', () => {
               if (barcode) {
                    setUsername(barcode);
               }
          });

          return unsubscribe;
     }, [navigation, barcode]);

     const initialValidation = async () => {
          setLoginError(false);
          setLoginErrorMessage('');
          updateCatalogStatus({
               message: null,
               status: 0,
          });
          logDebugMessage ("Base Url is: " + patronsLibrary['baseUrl'] + " library is: " + patronsLibrary['libraryId']);
          const result = await checkAspenDiscovery(patronsLibrary['baseUrl'], patronsLibrary['libraryId']);
          if (result.success) {
               logDebugMessage("Successfully received library info");
               const version = formatDiscoveryVersion(result.library.discoveryVersion);

               // check if catalog is in offline mode
               logDebugMessage("Checking if catalog is offline baseUrl:" + patronsLibrary['baseUrl'] );
               const currentStatus = await getCatalogStatus(patronsLibrary['baseUrl']);
               if (currentStatus) {
                    logDebugMessage('Catalog status: ' + JSON.stringify(currentStatus));
                    updateCatalogStatus(currentStatus);
                    if (currentStatus.status >= 1) {
                         // catalog is offline
                         logInfoMessage('catalog is offline');
                         setLoading(false);
                         setLoginError(true);
                         if (currentStatus.message) {
                              let tmp = stripHTML(currentStatus.message);
                              tmp = tmp.trim();
                              setLoginErrorMessage(tmp);
                         } else {
                              getTermFromDictionary('en', 'catalog_offline_message');
                         }
                         return;
                    } else {
                         logInfoMessage('catalog online');
                         logDebugMessage(catalogStatus);
                         updateCatalogStatus({
                              status: 0,
                              message: null,
                         });
                    }
               }else{
                    logDebugMessage('Could not get catalog status');
               }

               setPinValidationRules(result.library.pinValidationRules);
               const validatedUser = await loginToLiDA(valueUser, valueSecret, patronsLibrary['baseUrl']);
               if (validatedUser) {
                    logDebugMessage("Successfully logged in");
                    GLOBALS.appSessionId = validatedUser.session ?? '';
                    PATRON.language = validatedUser.lang ?? 'en';
                    PATRON.homeLocationId = validatedUser.homeLocationId ?? null;
                    updateLanguage(validatedUser.lang ?? 'en');
                    if (validatedUser.success) {
                         await setAsyncStorage();
                         signIn();
                         setLoading(false);
                    } else {
                         if (validatedUser.resetToken) {
                              logInfoMessage('Expired pin!');
                              setResetToken(validatedUser.resetToken);
                              setUserId(validatedUser.userId);
                              setExpiredPin(true);
                              setLoading(false);
                         } else {
                              logInfoMessage(validatedUser.message);
                              setLoginError(true);
                              setLoginErrorMessage(validatedUser.message);
                              setLoading(false);
                         }
                    }
               }else{
                    setLoginError(true);
                    setLoginErrorMessage(getTermFromDictionary('en', 'unknown_login_error'));
                    setLoading(false);
                    logWarnMessage("Could not login to library");
                    logWarnMessage(validatedUser);
               }
          } else {
               logWarnMessage("Could not connect to library, base url is " + patronsLibrary['baseUrl']);
               setLoading(false);
               setLoginError(true);
               setLoginErrorMessage(getTermFromDictionary('en', 'error_no_library_connection'));
          }
     };

     const openScanner = async () => {
          navigate('LibraryCardScanner', { allowCode39 });
     };

     const setAsyncStorage = async () => {
          await SecureStore.setItemAsync('userKey', valueUser);
          await SecureStore.setItemAsync('secretKey', valueSecret);
          await AsyncStorage.setItem('@lastStoredVersion', Constants.expoConfig.version);
          const autoPickUserHomeLocation = parseInt(LIBRARY.appSettings?.autoPickUserHomeLocation ?? 0);

          if (PATRON.homeLocationId && !includes(GLOBALS.slug, 'aspen-lida') && autoPickUserHomeLocation === 1) {
               console.log(PATRON.homeLocationId);
               await getLocationInfo(GLOBALS.url, PATRON.homeLocationId).then(async (patronsLibrary) => {
                    if (!isUndefined(patronsLibrary.baseUrl)) {
                         LIBRARY.url = patronsLibrary.baseUrl;
                         await SecureStore.setItemAsync('library', JSON.stringify(patronsLibrary.libraryId));
                         await AsyncStorage.setItem('@libraryId', JSON.stringify(patronsLibrary.libraryId));
                         await SecureStore.setItemAsync('libraryName', patronsLibrary.parentLibraryDisplayName);
                         await SecureStore.setItemAsync('locationId', JSON.stringify(patronsLibrary.locationId));
                         await AsyncStorage.setItem('@locationId', JSON.stringify(patronsLibrary.locationId));
                         await SecureStore.setItemAsync('solrScope', patronsLibrary.solrScope);

                         await AsyncStorage.setItem('@solrScope', patronsLibrary.solrScope);
                         await AsyncStorage.setItem('@pathUrl', patronsLibrary.baseUrl);
                    } else {
                         // library isn't on correct version of 24.06 ?
                    }
               });
          } else {
               await SecureStore.setItemAsync('library', patronsLibrary['libraryId']);
               await AsyncStorage.setItem('@libraryId', patronsLibrary['libraryId']);
               await SecureStore.setItemAsync('libraryName', patronsLibrary['name']);
               await SecureStore.setItemAsync('locationId', patronsLibrary['locationId']);
               await AsyncStorage.setItem('@locationId', patronsLibrary['locationId']);
               await SecureStore.setItemAsync('solrScope', patronsLibrary['solrScope']);

               await AsyncStorage.setItem('@solrScope', patronsLibrary['solrScope']);
               await AsyncStorage.setItem('@pathUrl', patronsLibrary['baseUrl']);
          }
     };

     if (expiredPin) {
          return <ResetExpiredPin username={valueUser} userId={userId} resetToken={resetToken} url={patronsLibrary['baseUrl']} pinValidationRules={pinValidationRules} setExpiredPin={setExpiredPin} patronsLibrary={patronsLibrary} />;
     }

     return (
          <>
               {loginError ? <DisplayMessage type="error" message={loginErrorMessage} /> : null}
               <FormControl>
                    <FormControlLabel>
                         <FormControlLabelText fontSize="$sm" color={textColor}>{usernameLabel}</FormControlLabelText>
                    </FormControlLabel>
                    <Input>
                         <InputField autoCapitalize="none"
                                       size="xl"
                                       autoCorrect={false}
                                       variant="filled"
                                       id="barcode"
                                       value={valueUser}
                                       onChangeText={(text) => setUsername(text)}
                                       returnKeyType="next"
                                       textContentType="username"
                                       required
                                       onSubmitEditing={() => {
                                            passwordRef.current.focus();
                                       }}
                                       blurOnSubmit={false}
                                     color={textColor}
                         />
                         {allowBarcodeScanner ?
                              <InputSlot onPress={() => openScanner()}>
                              <InputIcon as={Ionicons} name="barcode-outline" mr="$2" color={textColor} />
                         </InputSlot> : null}
                    </Input>
               </FormControl>
               <FormControl mt="$3">
                    <FormControlLabel>
                         <FormControlLabelText size="sm" color={textColor}>{passwordLabel}</FormControlLabelText>
                    </FormControlLabel>
                    <Input>
                         <InputField variant="filled"
                                     size="xl"
                                     type={showPassword ? 'text' : 'password'}
                                     returnKeyType="go"
                                     textContentType="password"
                                     ref={passwordRef}
                                     onChangeText={(text) => setPassword(text)}
                                     onSubmitEditing={async () => {
                                          setLoading(true);
                                          await initialValidation();
                                     }}
                                     required
                                     color={textColor}
                         />
                         <InputSlot onPress={toggleShowPassword}>
                              <InputIcon as={Ionicons} name={showPassword ? 'eye-outline' : 'eye-off-outline'} mr="$2" color={textColor} />
                         </InputSlot>
                    </Input>
               </FormControl>

               <Center>
                    <Button
                         mt="$3"
                         size="md"
                         bgColor={theme['colors']['primary']['500']}
                         isLoading={loading}
                         isLoadingText={getTermFromDictionary('en', 'logging_in', true)}
                         onPress={async () => {
                              setLoading(true);
                              await initialValidation();
                         }}>
                         <ButtonText color={theme['colors']['primary']['500-text']}>{getTermFromDictionary('en', 'login')}</ButtonText>
                    </Button>
               </Center>
          </>
     );
};

async function checkAspenDiscovery(url, id) {
     const discovery = create({
          baseURL: url + '/API',
          timeout: GLOBALS.timeoutFast,
          headers: getHeaders(false),
          auth: createAuthTokens(),
          params: {
               id: id,
          },
     });
     const response = await discovery.get('/SystemAPI?method=getLibraryInfo');
     if (response.ok) {
          return {
               success: true,
               library: response.data?.result?.library ?? [],
          };
     }

     return {
          success: false,
          library: [],
     };
}
