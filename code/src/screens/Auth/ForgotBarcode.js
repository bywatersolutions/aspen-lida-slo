import { create } from 'apisauce';
import _ from 'lodash';
import {
     Button,
     ButtonGroup,
     ButtonText,
     Center,
     FormControl,
     FormControlLabel,
     FormControlLabelText,
     Input,
     InputField,
     Modal,
     ModalContent,
     ModalHeader,
     ModalBody,
     ModalFooter,
     Text,
     ModalBackdrop, Icon, CloseIcon, ModalCloseButton,
} from '@gluestack-ui/themed';
import React from 'react';
import { Platform } from 'react-native';
import { LibrarySystemContext, ThemeContext } from '../../context/initialContext';
import { getTermFromDictionary, getTranslation, getTranslationsWithValues } from '../../translations/TranslationService';
import { createAuthTokens, getHeaders, stripHTML } from '../../util/apiAuth';
import { GLOBALS } from '../../util/globals';
import { LIBRARY } from '../../util/loadLibrary';
import { useKeyboard } from '../../util/useKeyboard';

export const ForgotBarcode = (props) => {
     const isKeyboardOpen = useKeyboard();
     const { theme, textColor, colorMode }= React.useContext(ThemeContext);
     const { library } = React.useContext(LibrarySystemContext);
     const { usernameLabel, showForgotBarcodeModal, setShowForgotBarcodeModal } = props;
     const [isProcessing, setIsProcessing] = React.useState(false);
     const language = 'en';
     const [isLoading, setIsLoading] = React.useState(false);

     let libraryUrl = library.baseUrl ?? LIBRARY.url;

     const [phoneNumber, setPhoneNumber] = React.useState('');
     const [showResults, setShowResults] = React.useState(false);
     const [results, setResults] = React.useState('');

     const [buttonLabel, setButtonLabel] = React.useState('Forgot Barcode?');
     const [modalTitle, setModalTitle] = React.useState('Forgot Barcode');
     const [fieldLabel, setFieldLabel] = React.useState('Phone Number');
     const [modalBody, setModalBody] = React.useState('');
     const [modalButtonLabel, setModalButtonLabel] = React.useState('Send My Barcode');

     React.useEffect(() => {
          setIsLoading(true);

          async function fetchTranslations() {
               await getTranslationsWithValues('forgot_barcode_link', usernameLabel, language, libraryUrl).then((result) => {
                    let term = _.toString(result);
                    if (!term.includes('%')) {
                         setButtonLabel(term);
                    }
               });
               await getTranslationsWithValues('forgot_barcode_title', usernameLabel, language, libraryUrl).then((result) => {
                    let term = _.toString(result);
                    if (!term.includes('%')) {
                         setModalTitle(term);
                    }
               });
               await getTranslation('Phone Number', language, libraryUrl).then((result) => {
                    let term = _.toString(result);
                    if (!term.includes('%')) {
                         setModalButtonLabel(term);
                    }
               });
               await getTranslationsWithValues('send_my_barcode', usernameLabel, language, libraryUrl).then((result) => {
                    let term = _.toString(result);
                    if (!term.includes('%')) {
                         setModalButtonLabel(term);
                    }
               });
               await getTranslationsWithValues('forgot_barcode_body', usernameLabel, language, libraryUrl).then((result) => {
                    let term = _.toString(result);
                    if (!term.includes('%')) {
                         setModalBody(term);
                    }
               });
               setIsLoading(false);
          }

          fetchTranslations();
     }, [language, libraryUrl]);

     const closeWindow = () => {
          setShowForgotBarcodeModal(false);
          setIsProcessing(false);
          setShowResults(false);
          setResults('');
     };

     const initiateForgotBarcode = async () => {
          setIsProcessing(true);
          await forgotBarcode(phoneNumber, libraryUrl).then((data) => {
               setResults(data);
               setShowResults(true);
          });
          setIsProcessing(false);
     };

     const resetWindow = () => {
          setShowResults(false);
          setResults('');
     };

     if (isLoading) {
          return null;
     }

     return (
          <Center>
               <Button variant="link" onPress={() => setShowForgotBarcodeModal(true)}>
                    <ButtonText color={theme['colors']['primary']['500']}>{buttonLabel}</ButtonText>
               </Button>
               <Modal isOpen={showForgotBarcodeModal} size="md" avoidKeyboard onClose={() => setShowForgotBarcodeModal(false)} pb={Platform.OS === 'android' && isKeyboardOpen ? '50%' : '0'}>
                    <ModalBackdrop />
                    <ModalContent bgColor={colorMode === 'light' ? theme['colors']['warmGray']['50'] : theme['colors']['coolGray']['700']}>
                         <ModalHeader>
                              <Heading size="md" color={textColor}>{modalTitle}</Heading>
                              <ModalCloseButton hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}>
                                   <Icon as={CloseIcon} color={textColor} />
                              </ModalCloseButton>
                         </ModalHeader>
                         <ModalBody>
                              {showResults && !results.success ? (
                                   <>
                                        <Text color={textColor}>{stripHTML(results.message)}</Text>
                                        <Button bgColor={theme['colors']['primary']['500']} onPress={resetWindow}>
                                             <ButtonText color={theme['colors']['primary']['500-text']}>{getTermFromDictionary('en', 'try_again')}</ButtonText>
                                        </Button>
                                   </>
                              ) : showResults ? (
                                   <Text color={textColor}>{stripHTML(results.message)}</Text>
                              ) : (
                                   <>
                                        <Text color={textColor}>{modalBody}</Text>
                                        <FormControl>
                                             <FormControlLabel>
                                                  <FormControlLabelText fontSize="$sm" color={textColor}>{fieldLabel}</FormControlLabelText>
                                             </FormControlLabel>
                                             <Input><InputField id="phoneNumber" variant="filled" size="xl" returnKeyType="done" enterKeyHint="done" onChangeText={(text) => setPhoneNumber(text)} onSubmitEditing={() => initiateForgotBarcode()} color={textColor} textContentType="telephoneNumber"/></Input>
                                        </FormControl>
                                   </>
                              )}
                         </ModalBody>
                         <ModalFooter>
                              <ButtonGroup space="$2">
                                   {showResults ? (
                                        <Button variant="link" onPress={closeWindow}>
                                             <ButtonText color={textColor}>{getTermFromDictionary('en', 'button_ok')}</ButtonText>
                                        </Button>
                                   ) : (
                                        <>
                                             <Button variant="link" onPress={closeWindow}>
                                                  <ButtonText color={textColor}>{getTermFromDictionary('en', 'cancel')}</ButtonText>
                                             </Button>
                                             <Button
                                                  style={{
                                                       flexShrink: 1,
                                                  }}
                                                  isLoading={isProcessing}
                                                  isLoadingText={getTermFromDictionary('en', 'button_processing', true)}
                                                  bgColor={theme['colors']['primary']['500']}
                                                  onPress={initiateForgotBarcode}>
                                                  <ButtonText color={theme['colors']['primary']['500-text']}>{modalButtonLabel}</ButtonText>
                                             </Button>
                                        </>
                                   )}
                              </ButtonGroup>
                         </ModalFooter>
                    </ModalContent>
               </Modal>
          </Center>
     );
};

async function forgotBarcode(phone, url) {
     const discovery = create({
          baseURL: url + '/API',
          timeout: GLOBALS.timeoutFast,
          headers: getHeaders(),
          auth: createAuthTokens(),
     });
     const results = await discovery.get('/RegistrationAPI?method=lookupAccountByPhoneNumber', {
          phone: phone,
     });
     if (results.ok) {
          if (results.data.result) {
               return results.data.result;
          }
          return results.data;
     } else {
          return {
               success: false,
               message: 'Unable to connect to library',
          };
     }
}
