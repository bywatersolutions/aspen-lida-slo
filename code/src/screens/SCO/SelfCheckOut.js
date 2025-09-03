import React, {useState} from 'react';
import {
     CheckoutsContext,
     LanguageContext,
     LibraryBranchContext,
     LibrarySystemContext,
     ThemeContext,
     UserContext,
} from '../../context/initialContext';
import {
     Box,
     Button,
     ButtonGroup,
     ButtonIcon,
     ButtonText,
     Text,
     Heading,
     Center,
     HStack,
     Icon,
     FlatList,
     FormControl,
     FormControlLabel,
     FormControlLabelText,
     Input, InputField,
     Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalFooter,
     CloseIcon, ModalCloseButton,
     AlertDialog, AlertDialogBackdrop, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter,
} from '@gluestack-ui/themed';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getTermFromDictionary } from '../../translations/TranslationService';
import { navigateStack } from '../../helpers/RootNavigator';
import { Ionicons } from '@expo/vector-icons';
import _ from 'lodash';
import { loadingSpinner } from '../../components/loadingSpinner';
import { checkoutItem } from '../../util/recordActions';
import { useQueryClient } from '@tanstack/react-query';

export const SelfCheckOut = () => {
     const queryClient = useQueryClient();
     const navigation = useNavigation();
     const { library } = React.useContext(LibrarySystemContext);
     const { location } = React.useContext(LibraryBranchContext);
     const { language } = React.useContext(LanguageContext);
     const { user, cards, accounts, updateUser } = React.useContext(UserContext);
     const { checkouts, updateCheckouts } = React.useContext(CheckoutsContext);
     const passedItems = useRoute().params?.items ?? [];
     const [items, setItems] = React.useState(passedItems);
     const { selfCheckSettings } = React.useContext(LibraryBranchContext);
     const {textColor, colorMode, theme} = React.useContext(ThemeContext);

     let startNew = useRoute().params?.startNew ?? false;
     let activeAccount = useRoute().params?.activeAccount ?? user;

     let barcode = useRoute().params?.barcode ?? null;
     let barcodeType = useRoute().params?.type ?? null;
     let sessionCheckouts = [];

     let keyboardType = 0;
     if (selfCheckSettings.barcodeEntryKeyboardType) {
          keyboardType = selfCheckSettings.barcodeEntryKeyboardType;
     }
     const [showModal, setShowModal] = useState(false);
     const [showFinishModal, setShowFinishModal] = useState(false);
     const toggle = () => {
          barcode = null;
          setNewBarcode(null);
          setShowModal(!showModal);
     };
     const [newBarcode, setNewBarcode] = React.useState(null);

     let checkoutResult = null;
     let checkoutHasError = false;
     let checkoutErrorMessageBody = null;
     let checkoutErrorMessageTitle = null;
     const [isProcessingCheckout, setIsProcessingCheckout] = React.useState(false);

     const [isOpen, setIsOpen] = React.useState(false);
     const onClose = () => setIsOpen(false);
     const cancelRef = React.useRef(null);
     const [hasError, setHasError] = React.useState(false);
     const [errorBody, setErrorBody] = React.useState(null);
     const [errorTitle, setErrorTitle] = React.useState(null);

     //console.log(activeAccount);
     if (_.find(cards, ['ils_barcode', activeAccount])) {
          activeAccount = _.find(cards, ['ils_barcode', activeAccount]);
     } else if (_.find(cards, ['cat_username', activeAccount])) {
          activeAccount = _.find(cards, ['cat_username', activeAccount]);
     }

     React.useLayoutEffect(() => {
          navigation.setOptions({
               headerLeft: () => <Box />,
          });
     }, [navigation]);

     React.useEffect(() => {
          const updateCheckouts = navigation.addListener('focus', async () => {
               if (startNew) {
                    setItems([]);
                    startNew = false;
                    checkoutHasError = false;
               } else {
                    if (barcode) {
                         console.log('barcode: ' + barcode);
                         console.log('items:');
                         console.log(items);
                         console.log('session checkouts: ');
                         console.log(sessionCheckouts);
                         console.log('matching items: ');
                         console.log(_.find(sessionCheckouts, ['barcode', barcode]) ?? false);
                         //console.log(checkouts);
                         //console.log(_.find(checkouts, ['barcode', barcode]));
                         // check if item is already checked out
                         if (_.find(sessionCheckouts, ['barcode', barcode]) || _.find(checkouts, ['barcode', barcode])) {
                              // prompt error
                              setHasError(true);
                              setErrorBody(getTermFromDictionary(language, 'item_already_checked_out'));
                              setErrorTitle(getTermFromDictionary(language, 'unable_to_checkout_title'));
                              setIsOpen(true);
                         } else {
                              // do the checkout
                              setIsProcessingCheckout(true);
                              await checkoutItem(library.baseUrl, barcode, 'ils', activeAccount.userId ?? user.id, barcode, location.locationId, barcodeType, language).then((result) => {
                                   if (!result.success) {
                                        // prompt error
                                        setHasError(true);
                                        setErrorBody(result.message ?? getTermFromDictionary(language, 'unknown_error_checking_out'));
                                        setErrorTitle(result.title ?? getTermFromDictionary(language, 'unable_to_checkout_title'));
                                        setIsOpen(true);
                                   } else {
                                        let tmp = result.itemData;
                                        tmp.completionMessage = result.completionMessage ?? null;
                                        let updatedSession = _.concat(tmp, items);
                                        //console.log(tmp);
                                        //setItems(tmp);
                                        setItems([...items, tmp]);
                                        sessionCheckouts = updatedSession;

                                        queryClient.invalidateQueries({ queryKey: ['checkouts', user.id, library.baseUrl, language] });
                                        queryClient.invalidateQueries({ queryKey: ['user', library.baseUrl, language] });
                                        /*useQuery(['checkouts', user.id, library.baseUrl, language], () => getPatronCheckedOutItems('all', library.baseUrl, true, language), {
                                             onSuccess: (data) => {
                                                  updateCheckouts(data);
                                             },
                                        });*/
                                   }
                                   barcode = null;
                                   setIsProcessingCheckout(false);
                              });
                         }
                    }
               }
          });

          return updateCheckouts;
     }, [navigation, barcode, startNew]);

     const openScanner = async () => {
          barcode = null;
          navigateStack('SelfCheckTab', 'SelfCheckOutScanner', {
               activeAccount,
          });
     };

     const finishSession = () => {
          barcode = null;
          setShowFinishModal(true);
     };

     const startNewSession = () => {
          setShowFinishModal(false);
          if (_.size(accounts) >= 1) {
               navigation.replace('StartCheckOutSession', {
                    startNew: true,
               });
          } else {
               navigation.replace('SelfCheckOut', {
                    startNew: true,
                    barcode: null,
               });
          }
     };

     const goToCheckouts = () => {
          setShowFinishModal(false);
          navigateStack('AccountScreenTab', 'MyCheckouts');
     };

     const currentCheckoutHeader = () => {
          if (_.size(items) >= 1) {
               return (
                    <HStack space="md" justifyContent="space-between" pb="$2">
                         <Text bold fontSize="$xs" w="70%" color={textColor}>
                              {getTermFromDictionary(language, 'title')}
                         </Text>
                         <Text bold fontSize="$xs" w="25%" color={textColor}>
                              {getTermFromDictionary(language, 'checkout_due')}
                         </Text>
                    </HStack>
               );
          }
          return null;
     };

     const currentCheckOutItem = (item) => {
          if (item) {
               let title = item?.title ?? getTermFromDictionary(language, 'unknown_title');
               let barcode = item?.barcode ?? '';
               let dueDate = item?.due ?? '';
               let completionMessage = item?.completionMessage ?? '';
               return (
                   <>
                         <HStack space="md" justifyContent="space-between">
                              <Text fontSize="$xs" w="70%" color={textColor}>
                                   <Text bold color={textColor}>{title}</Text> ({barcode})
                              </Text>
                              <Text fontSize="$xs" w="25%" color={textColor}>
                                   {dueDate}
                              </Text>
                         </HStack>
                         {completionMessage !== '' ? (<Text color={textColor}>{completionMessage}</Text>) : null}
                   </>
               );
          }
          return null;
     };

     const currentCheckOutEmpty = () => {
          return <Text color={textColor}>{getTermFromDictionary(language, 'no_items_checked_out')}</Text>;
     };

     const currentCheckOutFooter = () => {};

     return (
          <Box p="$5" w="100%" style={{ flex: 1 }}>
               <Center pb="$5">
                    {activeAccount?.displayName ? (
                         <Text pb="$3" color={textColor}>
                              {getTermFromDictionary(language, 'checking_out_as')} {activeAccount.displayName}
                         </Text>
                    ) : null}
                    {keyboardType === 0 ? (
                        <Button bgColor={theme['colors']['secondary']['500']} onPress={() => openScanner()}>
                             <ButtonIcon as={Ionicons} name="barcode-outline" color={theme['colors']['secondary']['500-text']} />
                             <ButtonText color={theme['colors']['secondary']['500-text']}>{getTermFromDictionary(language, 'add_new_item')}</ButtonText>
                        </Button>
                    ) : (
                        <Center>
                             <FormControl>
                                  <Center>
                                       <FormControlLabel>
                                            <FormControlLabelText color={textColor}>{getTermFromDictionary(language, 'add_new_item')}</FormControlLabelText>
                                       </FormControlLabel>
                                       <ButtonGroup sp="md">
                                             <Button bgColor={theme['colors']['secondary']['500']}onPress={() => openScanner()}>
                                                  <ButtonIcon as={Ionicons} name="barcode-outline" color={theme['colors']['secondary']['500-text']}/>
                                                  <ButtonText color={theme['colors']['secondary']['500-text']}>{getTermFromDictionary(language, 'scan')}</ButtonText>
                                             </Button>
                                             <Button bgColor={theme['colors']['secondary']['500']} onPress={toggle}>
                                                  <ButtonIcon as={Ionicons} name="keypad-outline" color={theme['colors']['secondary']['500-text']} />
                                                  <ButtonText color={theme['colors']['secondary']['500-text']}>{getTermFromDictionary(language, 'type')}</ButtonText>
                                             </Button>
                                       </ButtonGroup>
                                  </Center>
                             </FormControl>
                             <Modal isOpen={showModal} onClose={toggle} size="md" avoidKeyboard>
                                  <ModalBackdrop />
                                  <ModalContent maxWidth="90%" bgColor={colorMode === 'light' ? theme['colors']['warmGray']['50'] : theme['colors']['coolGray']['700']}>
                                       <ModalHeader>
                                            <Heading size="md" color={textColor}>{getTermFromDictionary(language, 'add_new_item')}</Heading>
                                            <ModalCloseButton hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}>
                                                 <Icon as={CloseIcon} color={textColor} />
                                            </ModalCloseButton>
                                       </ModalHeader>
                                       <ModalBody>
                                            <FormControl pb="$5">
                                                 <Input borderColor={colorMode === 'light' ? theme['colors']['coolGray']['500'] : theme['colors']['gray']['300']}>
                                                      <InputField color={textColor} keyboardType={keyboardType === 1 ? 'number-pad' : 'default'} variant="outline" autoCapitalize="none" placeholder={getTermFromDictionary(language, 'enter_barcode')} size="$lg" defaultValue={newBarcode} onChangeText={text => setNewBarcode(text)}/>
                                                 </Input>
                                            </FormControl>
                                       </ModalBody>
                                       <ModalFooter>
                                            <ButtonGroup>
                                                 <Button variant="outline" onPress={toggle} borderColor={theme['colors']['primary']['500']}>
                                                      <ButtonText color={theme['colors']['primary']['500']}>{getTermFromDictionary(language, 'close_window')}</ButtonText>
                                                 </Button>
                                                 <Button bgColor={theme['colors']['primary']['500']} onPress={() => {
                                                      navigation.replace('SelfCheckOut', {
                                                           barcode: newBarcode,
                                                           type: null,
                                                           activeAccount,
                                                           startNew: false,
                                                           items,
                                                      });

                                                 }}>
                                                      <ButtonText color={theme['colors']['primary']['500-text']}>{getTermFromDictionary(language, 'add_new_item')}</ButtonText>
                                                 </Button>
                                            </ButtonGroup>
                                       </ModalFooter>
                                  </ModalContent>
                             </Modal>
                        </Center>
                    )}
               </Center>
               <Heading size="md" pb="$2" color={textColor}>
                    {getTermFromDictionary(language, 'checked_out_during_session')}
               </Heading>
               {isProcessingCheckout ? (
                   <Center>
                        <Text pb="$5" color={textColor}>{getTermFromDictionary(language, 'processing_checkout_message')}</Text>
                        {loadingSpinner()}
                   </Center>
               ) : <FlatList data={items} keyExtractor={(item, index) => index.toString()} ListEmptyComponent={currentCheckOutEmpty()} ListHeaderComponent={currentCheckoutHeader()} renderItem={({ item }) => currentCheckOutItem(item)} />
               }
               <Center pt="$5">
                    <Button onPress={() => finishSession()} bgColor={theme['colors']['primary']['500']} size="sm">
                         <ButtonText color={theme['colors']['primary']['500-text']}>{getTermFromDictionary(language, 'button_finish')}</ButtonText>
                    </Button>
               </Center>
               <Center>
                    <AlertDialog leastDestructiveRef={cancelRef} isOpen={isOpen} onClose={onClose}>
                         <AlertDialogBackdrop />
                         <AlertDialogContent bgColor={colorMode === 'light' ? theme['colors']['warmGray']['50'] : theme['colors']['coolGray']['700']}>
                              <AlertDialogHeader><Heading size="md" color={textColor}>{errorTitle}</Heading></AlertDialogHeader>
                              <AlertDialogBody><Text color={textColor}>{errorBody}</Text></AlertDialogBody>
                              <AlertDialogFooter>
                                   <ButtonGroup space="sm">
                                        <Button variant="outline" borderColor={theme['colors']['primary']['500']} onPress={() => setIsOpen(false)}>
                                             <ButtonText color={theme['colors']['primary']['500']}>{getTermFromDictionary(language, 'button_ok')}</ButtonText>
                                        </Button>
                                   </ButtonGroup>
                              </AlertDialogFooter>
                         </AlertDialogContent>
                    </AlertDialog>
               </Center>
               <Center>
                    <AlertDialog leastDestructiveRef={cancelRef} isOpen={showFinishModal} onClose={() => startNewSession()} size="lg">
                         <AlertDialogBackdrop />
                         <AlertDialogContent bgColor={colorMode === 'light' ? theme['colors']['warmGray']['50'] : theme['colors']['coolGray']['700']}>
                              <AlertDialogHeader>
                                   <Heading color={textColor}>{getTermFromDictionary(language, 'finish_checkout_session')}</Heading>
                                   <Button variant="link" onPress={() => setShowFinishModal(false)} position="absolute" right="$3" top="$1" bg="transparent">
                                        <Icon as={CloseIcon} color={textColor}/>
                                   </Button>
                              </AlertDialogHeader>
                              <AlertDialogBody>
                                   <Text color={textColor}>{getTermFromDictionary(language, 'finish_checkout_session_body')}</Text>
                              </AlertDialogBody>
                              <AlertDialogFooter>
                                   <HStack w="100%" justifyContent="center">
                                        <Button size="sm" onPress={() => startNewSession()} bgColor={theme['colors']['primary']['500']} mr="$5">
                                             <ButtonText color={theme['colors']['primary']['500-text']}>{getTermFromDictionary(language, 'start_new_session')}</ButtonText>
                                        </Button>
                                        <Button size="sm" bgColor={theme['colors']['primary']['500']} onPress={() => goToCheckouts()}>
                                             <ButtonText color={theme['colors']['primary']['500-text']}>{getTermFromDictionary(language, 'view_checkouts')}</ButtonText>
                                        </Button>
                                   </HStack>
                              </AlertDialogFooter>
                         </AlertDialogContent>
                    </AlertDialog>
               </Center>
          </Box>
     );
};
