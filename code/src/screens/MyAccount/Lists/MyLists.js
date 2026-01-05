import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import _ from 'lodash';
import moment from 'moment';
import { Badge, BadgeText, Box, Center, ChevronDownIcon, FlatList, Heading, HStack, Pressable, ScrollView, Select, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger, Text, VStack } from '@gluestack-ui/themed';
import React from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// custom components and helper files
import { loadingSpinner } from '../../../components/loadingSpinner';
import { DisplaySystemMessage } from '../../../components/Notifications';
import { LanguageContext, LibrarySystemContext, SystemMessagesContext, ThemeContext, UserContext } from '../../../context/initialContext';
import { navigateStack } from '../../../helpers/RootNavigator';
import { getTermFromDictionary } from '../../../translations/TranslationService';
import { formatLists, getListDetails, getListGroupDetails, getListGroups, getLists, getListTitles } from '../../../util/api/list';
import CreateList from './CreateList';
import { logDebugMessage, logErrorMessage, logInfoMessage } from '../../../util/logging';
import { getErrorMessage } from '../../../util/apiAuth';
import CreateListGroup from './CreateListGroup';
import { Platform } from 'react-native';
import { EditListGroup } from './EditListGroup';
import { EditListGroupParent } from './EditListGroupParent';
import { DeleteListGroup } from './DeleteListGroup';

const blurhash = 'MHPZ}tt7*0WC5S-;ayWBofj[K5RjM{ofM_';

export const MyLists = () => {
     const navigation = useNavigation();
     const hasPendingChanges = useRoute().params.hasPendingChanges ?? false;
     const { user } = React.useContext(UserContext);
     const { library } = React.useContext(LibrarySystemContext);
     const { lists, updateLists, listGroups, updateListGroups } = React.useContext(UserContext);
     const { language } = React.useContext(LanguageContext);

     const [loading, setLoading] = React.useState(false);

     const queryClient = useQueryClient();
     const { systemMessages, updateSystemMessages } = React.useContext(SystemMessagesContext);

     const { theme, textColor, colorMode } = React.useContext(ThemeContext);

     const insets = useSafeAreaInsets();

     const [currentListGroup, setCurrentListGroup] = React.useState(-1);
     const [currentListGroupData, setCurrentListGroupData] = React.useState({
          listGroupDetails: {
               title: '',
               id: -1,
          },
          listsInGroup: [],
     });

     const isFocused = useIsFocused();

     let hasListGroups = false;
     if(user.numListGroups) {
          hasListGroups = user.numListGroups > 0;
     }

     let defaultListGroup = null;
     if(user.lastListGroupViewed) {
          defaultListGroup = user.lastListGroupViewed;
     }

     React.useEffect(() => {
          if (isFocused) {
               if (hasPendingChanges) {
                    setLoading(true);
                    queryClient.invalidateQueries({ queryKey: ['lists', user.id, library.baseUrl, language] });
                    queryClient.invalidateQueries({ queryKey: ['list_groups', user.id, library.baseUrl, language] });
                    if(currentListGroup !== -1) {
                         updateSelectedListGroup(currentListGroup);
                    }
                    navigation.setParams({
                         hasPendingChanges: false,
                    });
               }
               if(currentListGroup === -1 && defaultListGroup) {
                    updateSelectedListGroup(defaultListGroup);
               }
          }
     }, [isFocused]);

     React.useLayoutEffect(() => {
          navigation.setOptions({
               headerLeft: () => <Box />,
          });
     }, [navigation]);

     useQuery(['lists', user.id, library.baseUrl, language], () => getLists(library.baseUrl), {
          initialData: lists,
          onSuccess: (data) => {
               if(data.ok) {
                    const lists = formatLists(data.data.result);
                    updateLists(lists)
               } else {
                    logDebugMessage("Error fetching user linked accounts");
                    logDebugMessage(data);
                    getErrorMessage(data.code ?? 0, data.problem);
               }
               setLoading(false);
          },
          onSettle: (data) => {
               setLoading(false);
          },
          onError: (error) => {
               logDebugMessage("Error fetching user lists");
               logErrorMessage(error);
          }
     });

     useQuery(['list_groups', user.id, library.baseUrl, language], () => getListGroups(library.baseUrl), {
          initialData: listGroups,
          onSuccess: (data) => {
               if(data.ok) {
                    const groups = {
                         groups: data.data?.result?.groups ?? [],
                         unassigned: data.data?.result?.unassigned ?? []
                    };
                    updateListGroups(groups);
               } else {
                    logDebugMessage("Error fetching user list groups");
                    logDebugMessage(data);
                    getErrorMessage(data.code ?? 0, data.problem);
               }
               setLoading(false);
          },
          onSettle: (data) => {
               setLoading(false);
          },
          onError: (error) => {
               logDebugMessage("Error fetching user list groups");
               logErrorMessage(error);
          }
     });

     useQueries({
          queries: lists.map((list) => {
               return {
                    queryKey: ['list', list.id, user.id],
                    queryFn: () => getListTitles(list.id, library.baseUrl, 1, 25, 25, 'dateAdded'),
               };
          }),
     });

     useQueries({
          queries: lists.map((list) => {
               return {
                    queryKey: ['list-details', list.id, user.id],
                    queryFn: () => getListDetails(list.id, library.baseUrl),
               };
          }),
     });

     const updateSelectedListGroup = async (groupId) => {
          setLoading(true);
          setCurrentListGroup(groupId);
          await getListGroupDetails(groupId, library.baseUrl).then((res) => {
               if(res.ok) {
                    setCurrentListGroupData(res.data.result);
               } else {
                    logDebugMessage("Error fetching user list group details for group " + groupId);
                    logDebugMessage(res);
                    getErrorMessage(res.code ?? 0, res.problem);
               }
          });
          setLoading(false);
     }

     const handleOpenList = (item) => {
          navigateStack('AccountScreenTab', 'MyList', {
               id: item.id,
               details: item,
               title: item.title,
               libraryUrl: library.baseUrl,
          });
     };

     const listEmptyComponent = () => {
          return (
               <Center mt={5} mb={5}>
                    <Text bold fontSize="$lg">
                         {getTermFromDictionary(language, 'no_lists_yet')}
                    </Text>
               </Center>
          );
     };

     const renderList = (item) => {
          let lastUpdated = moment.unix(item.dateUpdated);
          lastUpdated = moment(lastUpdated).format('MMM D, YYYY');
          const listLastUpdatedOn = getTermFromDictionary(language, 'last_updated_on') + ' ' + lastUpdated;
          const numListItems = item.numTitles ?? 0 + ' ' + getTermFromDictionary(language, 'items');
          let privacy = getTermFromDictionary(language, 'private');
          if (item.public === 1 || item.public === true || item.public === 'true') {
               privacy = getTermFromDictionary(language, 'public');
          }
          const imageUrl = item.cover ?? library.baseUrl + '/bookcover.php?type=list&id=' + item.id + '&size=medium';
          if (item.id !== 'recommendations') {
               return (
                    <Pressable
                         onPress={() => {
                              handleOpenList(item);
                         }}
                         borderBottomWidth="$1"
                         _dark={{ borderColor: 'gray.600' }}
                         borderColor="coolGray.200"
                         pl="$1"
                         pr="$1"
                         py="$2"
                         >
                         <HStack space={3} mt="$2" mb="$2" justifyContent="flex-start">
                              <VStack space={1}>
                                   <Image
                                        alt={item.title}
                                        source={imageUrl}
                                        style={{
                                             width: 100,
                                             height: 150,
                                             borderRadius: 4,
                                        }}
                                        placeholder={blurhash}
                                        transition={1000}
                                        contentFit="cover"
                                   />
                                   <Badge mt={1}><BadgeText>{privacy}</BadgeText></Badge>
                              </VStack>
                              <VStack space={1} justifyContent="space-between" maxW="80%" pl="$2">
                                   <Box>
                                        <Text bold fontSize="$md" color={textColor}>
                                             {item.title}
                                        </Text>
                                        {item.description ? (
                                             <Text fontSize="$xs" mb={2} color={textColor}>
                                                  {item.description}
                                             </Text>
                                        ) : null}
                                        <Text fontSize="$xs" italic color={textColor}>
                                             {listLastUpdatedOn}
                                        </Text>
                                        <Text fontSize="$xs" italic color={textColor}>
                                             {numListItems}
                                        </Text>
                                   </Box>
                              </VStack>
                         </HStack>
                    </Pressable>
               );
          }
     };

     const showSystemMessage = () => {
          if (_.isArray(systemMessages)) {
               return systemMessages.map((obj, index, collection) => {
                    if (obj.showOn === '0' || obj.showOn === '1') {
                         return <DisplaySystemMessage style={obj.style} message={obj.message} dismissable={obj.dismissable} id={obj.id} all={systemMessages} url={library.baseUrl} updateSystemMessages={updateSystemMessages} queryClient={queryClient} />;
                    }
               });
          }
          return null;
     };

     if (loading) {
          return loadingSpinner();
     }

     return (
          <SafeAreaView style={{ flex: 1 }}>
               <Box p="$5" bgColor={colorMode === 'light' ? theme['colors']['coolGray']['100'] : theme['colors']['coolGray']['700']} borderBottomWidth="$1" borderColor={colorMode === 'light' ? theme['colors']['coolGray']['200'] : theme['colors']['gray']['600']}>
                    {showSystemMessage()}
                    <ScrollView horizontal>
                         <HStack space="sm">
                              <CreateList setLoading={setLoading} />
                              <CreateListGroup setLoading={setLoading} />
                         </HStack>
                    </ScrollView>
                    {hasListGroups && Object.values(listGroups.groups) ? (
                         <>
                              <Select
                                   name="listGroupSelect"
                                   selectedValue={currentListGroup}
                                   defaultValue={defaultListGroup}
                                   mt="$1"
                                   mb="$2"
                                   onValueChange={(itemValue) => updateSelectedListGroup(itemValue)}>
                                   <SelectTrigger variant="outline" size="md">
                                        {currentListGroup && currentListGroup !== -1 ? (
                                             _.map(Object.values(listGroups.groups), function (group, selectedIndex, array) {
                                                  if (group.id === currentListGroup) {
                                                       return <SelectInput placeholder={group.title} value={group.id} color={textColor} />;
                                                  }
                                             })
                                        ) : defaultListGroup ? (
                                             <SelectInput value={defaultListGroup} color={textColor} />
                                        ) : null}
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
                                             {_.map(Object.values(listGroups.groups), function (item, index, array) {
                                                  return <SelectItem key={index} value={item.id} label={item.title} bgColor={currentListGroup === item.id ? theme['colors']['tertiary']['300'] : ''} sx={{ _text: { color: currentListGroup === item.id ? theme['colors']['tertiary']['500-text'] : textColor } }} />;
                                             })}
                                        </SelectContent>
                                   </SelectPortal>
                              </Select>
                              {currentListGroupData ? (
                                   <Box borderBottomWidth="$1"
                                        _dark={{ borderColor: 'gray.600' }}
                                        borderColor="coolGray.200">
                                        <Heading>{currentListGroupData.listGroupDetails?.title}</Heading>
                                        <ScrollView horizontal>
                                             <HStack space="sm">
                                                  <EditListGroup id={currentListGroupData.listGroupDetails?.id} currentTitle={currentListGroupData.listGroupDetails?.title} handleUpdate={updateSelectedListGroup} />
                                                  <EditListGroupParent id={currentListGroupData.listGroupDetails?.id} parentId={currentListGroupData.listGroupDetails?.parentGroupId} handleUpdate={updateSelectedListGroup} />
                                                  <DeleteListGroup id={currentListGroupData.listGroupDetails?.id} handleUpdate={updateSelectedListGroup} setCurrentListGroup={setCurrentListGroup} />
                                             </HStack>
                                        </ScrollView>
                                        <FlatList mt="$2" data={currentListGroupData.listsInGroup} renderItem={({ item }) => renderList(item, library.baseUrl)} keyExtractor={(item, index) => index.toString()} ListEmptyComponent={listEmptyComponent} />
                                   </Box>
                              ) : null}
                              {listGroups.unassigned.length > 0 ? (
                                   <>
                                        <Heading mt="$5" size="md" color={textColor}>
                                             {getTermFromDictionary(language, 'unassigned_lists')}
                                        </Heading>
                                        <FlatList mt="$2" data={listGroups.unassigned} renderItem={({ item }) => renderList(item, library.baseUrl)} keyExtractor={(item, index) => index.toString()} />
                                   </>
                              ) : null}
                         </>
                    ) : (
                         <FlatList mt="$2" data={lists} ListEmptyComponent={listEmptyComponent} renderItem={({ item }) => renderList(item, library.baseUrl)} keyExtractor={(item, index) => index.toString()} />
                    )}
               </Box>
          </SafeAreaView>
     );
};
