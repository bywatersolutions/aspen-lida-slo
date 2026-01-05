import React, { useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { LanguageContext, LibrarySystemContext, ThemeContext, UserContext } from '../../../context/initialContext';
import { Center, Button, ButtonIcon, ButtonText, Modal, ModalBackdrop, ModalContent, ModalHeader, Heading, ModalCloseButton, Icon, CloseIcon, ModalBody, ModalFooter, ButtonGroup, FormControlLabel, FormControlLabelText, Select, SelectTrigger, SelectInput, SelectIcon, ChevronDownIcon, SelectPortal, SelectBackdrop, SelectContent, SelectDragIndicatorWrapper, SelectDragIndicator, SelectItem, FormControl } from '@gluestack-ui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { getTermFromDictionary } from '../../../translations/TranslationService';
import { editListGroupParent } from '../../../util/api/list';
import { popAlert } from '../../../components/loadError';
import { navigateStack } from '../../../helpers/RootNavigator';
import { Platform } from 'react-native';
import _ from 'lodash';

export const EditListGroupParent = ({id, parentId, handleUpdate}) => {
     const queryClient = useQueryClient();
     const { user, listGroups } = React.useContext(UserContext);
     const { library } = React.useContext(LibrarySystemContext);
     const { language } = React.useContext(LanguageContext);
     const { textColor, theme, colorMode } = React.useContext(ThemeContext);
     const [showModal, setShowModal] = React.useState(false);
     const [loading, setLoading] = React.useState(false);

     const [newListGroupParentId, setNewListGroupParentId] = React.useState(parentId); // default state is current list group parent id

     const insets = useSafeAreaInsets();

     const toggle = () => {
          setShowModal(!showModal);
     };

     return (
          <Center>
               <Button onPress={toggle} size="xs" bgColor={theme['colors']['primary']['500']}>
                    <ButtonIcon color={theme['colors']['primary']['500-text']} as={MaterialIcons} name="edit" mr="$1" />
                    <ButtonText color={theme['colors']['primary']['500-text']}>{getTermFromDictionary(language, 'move_list_group')}</ButtonText>
               </Button>
               <Modal isOpen={showModal} onClose={toggle} size="full" avoidKeyboard>
                    <ModalBackdrop />
                    <ModalContent maxWidth="90%"  bgColor={colorMode === 'light' ? theme['colors']['warmGray']['50'] : theme['colors']['coolGray']['700']}>
                         <ModalHeader>
                              <Heading size="md" color={textColor}>{getTermFromDictionary(language, 'move_list_group')}</Heading>
                              <ModalCloseButton hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}>
                                   <Icon as={CloseIcon} color={textColor} />
                              </ModalCloseButton>
                         </ModalHeader>
                         <ModalBody>
                              <FormControl pb="$5">
                                   <FormControlLabel>
                                        <FormControlLabelText color={textColor}>{getTermFromDictionary(language, 'move_list_group_to')}</FormControlLabelText>
                                   </FormControlLabel>
                                   <Select
                                        name="newListGroupParent"
                                        selectedValue={newListGroupParentId}
                                        accessibilityLabel={getTermFromDictionary(language, 'move_list_group_to')}
                                        mt="$1"
                                        mb="$2"
                                        onValueChange={(itemValue) => setNewListGroupParentId(itemValue)}>
                                        <SelectTrigger variant="outline" size="md">
                                             <SelectInput color={textColor} value={newListGroupParentId} />
                                             <SelectIcon mr="$3" as={ChevronDownIcon} color={textColor} />
                                        </SelectTrigger>
                                        <SelectPortal>
                                             <SelectBackdrop />
                                             <SelectContent
                                                  bgColor={colorMode === 'light' ? theme['colors']['warmGray']['50'] : theme['colors']['coolGray']['700']}
                                                  pb={Platform.OS === 'android' ? insets.bottom + 16 : '$4'}
                                             >
                                                  <SelectDragIndicatorWrapper>
                                                       <SelectDragIndicator />
                                                  </SelectDragIndicatorWrapper>
                                                  {_.map(listGroups.groups, function (item, index, array) {
                                                       return <SelectItem key={index} value={item.id} label={item.title} bgColor={newListGroupParentId === item.id ? theme['colors']['tertiary']['300'] : ''} sx={{ _text: { color: newListGroupParentId === item.id ? theme['colors']['tertiary']['500-text'] : textColor } }} />;
                                                  })}
                                             </SelectContent>
                                        </SelectPortal>
                                   </Select>
                              </FormControl>
                         </ModalBody>
                         <ModalFooter>
                              <ButtonGroup>
                                   <Button variant="outline" onPress={toggle} borderColor={theme['colors']['primary']['500']}>
                                        <ButtonText color={theme['colors']['primary']['500']}>{getTermFromDictionary(language, 'close_window')}</ButtonText>
                                   </Button>
                                   <Button bgColor={theme['colors']['primary']['500']}
                                           isLoading={loading}
                                           isLoadingText={getTermFromDictionary(language, 'saving', true)}
                                           onPress={() => {
                                                setLoading(true);
                                                editListGroupParent(id, newListGroupParentId, library.baseUrl).then(async (res) => {
                                                     queryClient.invalidateQueries({ queryKey: ['list_groups', user.id, library.baseUrl, language] });
                                                     queryClient.invalidateQueries({ queryKey: ['lists', user.id, library.baseUrl, language] });
                                                     setLoading(false);
                                                     let status = 'success';
                                                     setShowModal(false);
                                                     handleUpdate(id);
                                                     if (res.data.result.success === false) {
                                                          status = 'error';
                                                          popAlert(res.data.result.title, res.data.result.message, status);
                                                     } else {
                                                          popAlert(res.data.result.title, res.data.result.message, status);
                                                          navigateStack('AccountScreenTab', 'MyLists', {
                                                               libraryUrl: library.baseUrl,
                                                               hasPendingChanges: true,
                                                          });
                                                     }
                                                });
                                           }}>
                                        <ButtonText color={theme['colors']['primary']['500-text']}>{getTermFromDictionary(language, 'save')}</ButtonText>
                                   </Button>
                              </ButtonGroup>
                         </ModalFooter>
                    </ModalContent>
               </Modal>
          </Center>
     );
}
