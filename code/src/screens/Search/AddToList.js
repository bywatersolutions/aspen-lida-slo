import { MaterialIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import _ from 'lodash';
import React, { useState } from 'react';
import { Platform } from 'react-native';
import Modal from 'react-native-modal';
import { LanguageContext, LibrarySystemContext, ThemeContext, UserContext } from '../../context/initialContext';
import { getTermFromDictionary } from '../../translations/TranslationService';
import { addTitlesToList, createListFromTitle } from '../../util/api/list';

import { PATRON } from '../../util/loadPatron';
import {
     Box,
     Center,
     CloseIcon,
     FormControl,
     HStack,
     Icon,
     Input,
     InputField,
     Pressable,
     Radio,
     RadioGroup,
     Text,
     Textarea,
     VStack,
     Button,
     ButtonText,
     ButtonGroup,
     ButtonIcon,
     ChevronDownIcon,
     Select,
     SelectBackdrop,
     SelectDragIndicator,
     SelectDragIndicatorWrapper,
     SelectIcon,
     SelectInput,
     SelectTrigger,
     SelectPortal,
     SelectItem,
     SelectContent,
     FormControlLabel,
     FormControlLabelText,
     RadioIndicator,
     RadioIcon,
     CircleIcon,
     RadioLabel,
     TextareaInput,
} from '@gluestack-ui/themed';

export const AddToList = (props) => {
     const item = props.itemId;
     const btnStyle = props.btnStyle;
     const source = props.source ?? 'GroupedWork';
     const btnWidth = props.btnWidth ?? 'auto';
     const [open, setOpen] = React.useState(false);
     const [screen, setScreen] = React.useState('add-new');
     const [loading, setLoading] = React.useState(false);
     const { library } = React.useContext(LibrarySystemContext);
     const { user, updateUser } = React.useContext(UserContext);
     const { language } = React.useContext(LanguageContext);
     const lists = PATRON.lists;
     const [listId, setListId] = useState();
     const [description, saveDescription] = useState();
     const [title, saveTitle] = useState();
     const [isPublic, saveIsPublic] = useState();
     const queryClient = useQueryClient();
     const { theme, textColor, colorMode } = React.useContext(ThemeContext);

     const toggleModal = () => {
          setOpen(!open);
          if (!open === true) {
               setListId(PATRON.listLastUsed);
          }
     };

     const updateLastListUsed = async (id) => {
          queryClient.invalidateQueries({ queryKey: ['list', id] });
          queryClient.invalidateQueries({ queryKey: ['lists', user.id, library.baseUrl, language] });
          queryClient.invalidateQueries({ queryKey: ['user', library.baseUrl, language] });
          PATRON.listLastUsed = id;
          setListId(id);
     };

     const LargeButton = () => {
          return (
               <Center>
                    <Button mt="$3" onPress={toggleModal} bgColor={theme['colors']['tertiary']['500']}>
                         <ButtonIcon color={theme['colors']['tertiary']['500-text']} as={MaterialIcons} name="bookmark"/>
                         <ButtonText color={theme['colors']['tertiary']['500-text']}>{getTermFromDictionary(language, 'add_to_list')}</ButtonText>
                    </Button>
               </Center>
          );
     };

     const SmallButton = () => {
          return (
               <Button mt="$1" size="xs" variant="link" onPress={toggleModal}>
                    <ButtonIcon color={theme['colors']['tertiary']['500']} as={MaterialIcons} name="bookmark"/>
                    <ButtonText color={theme['colors']['tertiary']['500']}>{getTermFromDictionary(language, 'add_to_list')}</ButtonText>
               </Button>
          );
     };

     const RegularButton = () => {
          return (
               <Button width={btnWidth} onPress={toggleModal} color={theme['colors']['primary']['500']}>
                    <ButtonText color={theme['colors']['primary']['500-text']}>{getTermFromDictionary(language, 'add_to_list')}</ButtonText>
               </Button>
          );
     };

     return (
          <>
               <Modal
                    isVisible={open}
                    avoidKeyboard={true}
                    onBackdropPress={() => {
                         setOpen(false);
                         setScreen('add-new');
                    }}>
                    <Box
                         rounded="md"
                         p="$2"
                         bgColor={colorMode === 'light' ? theme['colors']['warmGray']['50'] : theme['colors']['coolGray']['700']}
                    >
                         <VStack space="md">
                              {screen === 'add-new' && !_.isEmpty(lists) ? (
                                   <>
                                        <HStack
                                             p="$4"
                                             justifyContent="space-between"
                                             alignItems="flex-start"
                                           >
                                             <Text bold color={textColor}>{getTermFromDictionary(language, 'add_to_list')}</Text>
                                             <Pressable onPress={() => setOpen(false)}>
                                                  <CloseIcon
                                                       zIndex="1"
                                                       color={textColor}
                                                       p="$2"
                                                       bg="transparent"
                                                       borderRadius="sm"
                                                  />
                                             </Pressable>
                                        </HStack>
                                        <Box p="$4">
                                             <FormControl>
                                                  <VStack space="md">
                                                       <FormControl>
                                                            <FormControlLabel>
                                                                 <FormControlLabelText color={textColor}>{getTermFromDictionary(language, 'choose_a_list')}</FormControlLabelText>
                                                            </FormControlLabel>
                                                            <Select
                                                                 selectedValue={listId}
                                                                 defaultValue={listId}
                                                                 onValueChange={(itemValue) => {
                                                                      setListId(itemValue);
                                                                 }}>
                                                                 <SelectTrigger borderWidth={colorMode === 'light' ? '$none' : '$1'}
                                                                                borderColor={colorMode === 'light' ? '$none' : theme['colors']['gray']['400']}>
                                                                      <SelectInput color={textColor} placeholder="Select list" />
                                                                      <SelectIcon mr="$3">
                                                                           <Icon color={textColor} as={ChevronDownIcon} />
                                                                      </SelectIcon>
                                                                 </SelectTrigger>
                                                                 <SelectPortal useRNModal={true} >
                                                                      <SelectBackdrop />
                                                                      <SelectContent bgColor={colorMode === 'light' ? theme['colors']['warmGray']['50'] : theme['colors']['coolGray']['700']}>
                                                                           <SelectDragIndicatorWrapper>
                                                                                <SelectDragIndicator />
                                                                           </SelectDragIndicatorWrapper>
                                                                           {_.map(lists, function (item, index, array) {
                                                                                return <SelectItem key={index} value={item.id} label={item.title} bgColor={listId == item.id ? theme['colors']['tertiary']['300'] : ''} sx={{ _text: { color: listId == item.id ? theme['colors']['tertiary']['500-text'] : textColor } }} />;
                                                                           })}
                                                                      </SelectContent>
                                                                 </SelectPortal>
                                                            </Select>
                                                       </FormControl>
                                                       <HStack space="sm" alignItems="center">
                                                            <Text color={textColor}>{getTermFromDictionary(language, 'or')}</Text>
                                                            <Button
                                                                 bgColor={theme['colors']['primary']['500']}
                                                                 size="sm"
                                                                 onPress={() => {
                                                                      setScreen('create-new');
                                                                 }}>
                                                                 <ButtonText color={theme['colors']['primary']['500-text']}>{getTermFromDictionary(language, 'create_new_list')}</ButtonText>
                                                            </Button>
                                                       </HStack>
                                                  </VStack>
                                             </FormControl>
                                        </Box>

                                        <ButtonGroup
                                             p="$4"
                                             flexDirection="row"
                                             justifyContent="flex-end"
                                             flexWrap="wrap">
                                             <Button
                                                  borderColor={theme['colors']['primary']['500']}
                                                  variant="outline"
                                                  onPress={() => {
                                                       setOpen(false);
                                                       setScreen('add-new');
                                                  }}>
                                                  <ButtonText color={theme['colors']['primary']['500']}>{getTermFromDictionary(language, 'cancel')}</ButtonText>
                                             </Button>
                                             {!_.isEmpty(lists) ? (
                                                  <Button
                                                       bgColor={theme['colors']['primary']['500']}
                                                       isLoading={loading}
                                                       onPress={() => {
                                                            setLoading(true);
                                                            addTitlesToList(listId, item, library.baseUrl, source, language).then((res) => {
                                                                 updateLastListUsed(listId);
                                                                 queryClient.invalidateQueries({ queryKey: ['list', listId] });
                                                                 setLoading(false);
                                                                 setOpen(false);
                                                            });
                                                       }}>
                                                       <ButtonText color={theme['colors']['primary']['500-text']}>{getTermFromDictionary(language, 'save_to_list')}</ButtonText>
                                                  </Button>
                                             ) : (
                                                  <Button bgColor={theme['colors']['primary']['500']}><ButtonText color={theme['colors']['primary']['500-text']}>{getTermFromDictionary(language, 'create_new_list')}</ButtonText></Button>
                                             )}
                                        </ButtonGroup>
                                   </>
                              ) : (
                                   <>
                                        <HStack
                                             justifyContent="space-between"
                                             alignItems="flex-start"
                                             p="$4"
                                        >
                                             <Text bold color={textColor}>{getTermFromDictionary(language, 'create_new_list_item')}</Text>
                                             <Pressable onPress={() => setOpen(false)}>
                                                  <CloseIcon
                                                       zIndex="1"
                                                       colorScheme="coolGray"
                                                       p="$2"
                                                       bg="transparent"
                                                       borderRadius="sm"
                                                       color={textColor}
                                                  />
                                             </Pressable>
                                        </HStack>
                                        <Box p="$4">
                                             <VStack space="md">
                                                  <FormControl>
                                                       <FormControlLabel><FormControlLabelText color={textColor}>{getTermFromDictionary(language, 'title')}</FormControlLabelText></FormControlLabel>
                                                       <Input borderColor={colorMode === 'light' ? theme['colors']['coolGray']['500'] : theme['colors']['gray']['300']}>
                                                            <InputField id="title" onChangeText={(text) => saveTitle(text)} returnKeyType="next" color={textColor}/>
                                                       </Input>
                                                  </FormControl>
                                                  <FormControl>
                                                       <FormControlLabel><FormControlLabelText color={textColor}>{getTermFromDictionary(language, 'description')}</FormControlLabelText></FormControlLabel>
                                                       <Textarea id="description" onChangeText={(text) => saveDescription(text)} returnKeyType="next" borderColor={colorMode === 'light' ? theme['colors']['coolGray']['500'] : theme['colors']['gray']['300']}><TextareaInput color={textColor}/></Textarea>
                                                  </FormControl>
                                                  <FormControl>
                                                       <FormControlLabel><FormControlLabelText color={textColor}>{getTermFromDictionary(language, 'access')}</FormControlLabelText></FormControlLabel>
                                                       <RadioGroup
                                                            defaultValue="1"
                                                            onChange={(nextValue) => {
                                                                 saveIsPublic(nextValue);
                                                            }}>
                                                            <HStack direction="row" alignItems="center" space="md" w="75%" maxW="300px">
                                                                 <Radio value="1" my="$1">
                                                                      <RadioIndicator mr="$2" borderColor={colorMode === 'light' ? theme['colors']['coolGray']['500'] : theme['colors']['gray']['300']}>
                                                                           <RadioIcon as={CircleIcon} color={colorMode === 'light' ? theme['colors']['coolGray']['500'] : theme['colors']['gray']['300']} />
                                                                      </RadioIndicator>
                                                                      <RadioLabel color={textColor}>{getTermFromDictionary(language, 'private')}</RadioLabel>
                                                                 </Radio>
                                                                 <Radio value="0" my="$1">
                                                                      <RadioIndicator mr="$2" borderColor={colorMode === 'light' ? theme['colors']['coolGray']['500'] : theme['colors']['gray']['300']}>
                                                                           <RadioIcon as={CircleIcon} color={colorMode === 'light' ? theme['colors']['coolGray']['500'] : theme['colors']['gray']['300']} />
                                                                      </RadioIndicator>
                                                                      <RadioLabel color={textColor}>{getTermFromDictionary(language, 'public')}</RadioLabel>
                                                                 </Radio>
                                                            </HStack>
                                                       </RadioGroup>
                                                  </FormControl>
                                             </VStack>
                                        </Box>
                                        <ButtonGroup
                                             p="$4"
                                             flexDirection="row"
                                             justifyContent="flex-end"
                                             flexWrap="wrap"
                                        >
                                             <Button
                                                  variant="outline"
                                                  borderColor={theme['colors']['primary']['500']}
                                                  onPress={() => {
                                                       setOpen(false);
                                                       setScreen('add-new');
                                                  }}>
                                                  <ButtonText color={theme['colors']['primary']['500']}>{getTermFromDictionary(language, 'cancel')}</ButtonText>
                                             </Button>
                                             <Button
                                                  bgColor={theme['colors']['primary']['500']}
                                                  isLoading={loading}
                                                  isLoadingText={getTermFromDictionary(language, 'saving', true)}
                                                  onPress={() => {
                                                       setLoading(true);
                                                       createListFromTitle(title, description, isPublic, item, library.baseUrl, source).then((res) => {
                                                            updateLastListUsed(res.listId);
                                                            setOpen(false);
                                                            setLoading(false);
                                                            setScreen('add-new');
                                                       });
                                                  }}>
                                                  <ButtonText color={theme['colors']['primary']['500-text']}>{getTermFromDictionary(language, 'create_list')}</ButtonText>
                                             </Button>
                                        </ButtonGroup>
                                   </>
                              )}
                         </VStack>
                    </Box>
               </Modal>
               {btnStyle === 'lg' ? LargeButton() : btnStyle === 'reg' ? RegularButton() : SmallButton()}
          </>
     );
};

export default AddToList;