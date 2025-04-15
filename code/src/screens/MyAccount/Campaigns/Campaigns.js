import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Platform, SafeAreaView} from "react-native";
import { Actionsheet, Alert, AlertDialog, Box, Button, Center, CheckIcon, FlatList, FormControl, HStack, Icon, Pressable, ScrollView, Select, Text, useDisclose, VStack } from 'native-base';
import { fetchCampaigns, unenrollCampaign, enrollCampaign } from '../../../util/api/user';
import { getTermFromDictionary } from '../../../translations/TranslationService';
import { UserInterfaceIdiom } from 'expo-constants';
import { LanguageContext, LibrarySystemContext, UserContext } from '../../../context/initialContext';
import { filter } from 'lodash';
import { ChevronDownIcon, ChevronUpIcon } from 'native-base';
import { Image } from 'expo-image';



export const MyCampaigns = () => {
	const navigation = useNavigation();
	const queryClient = useQueryClient();
	const { user} = React.useContext(UserContext);
	const { library } = React.useContext(LibrarySystemContext);
	const { language } = React.useContext(LanguageContext);

	const [isLoading, setLoading] = React.useState(false);
	const [filterBy, setFilterBy] = React.useState('enrolled');
	const [page, setPage] = React.useState(1);
	const [paginationLabel, setPaginationLabel] = React.useState("");
	const [campaigns, updateCampaigns] = React.useState([]);
	const [enrollmentStatus, setEnrollmentStatus] = React.useState(false);
	const [emailNotificationStatus, setEmailNotificationStatus] = React.useState(false);
	const [openCampaignInfo, setOpenCampaignInfo] = React.useState({});
	const [expandedCampaigns, setExpandedCampaigns] = React.useState(false);
	const [selectedCampaign, setSelectedCampaign] = React.useState(null);
	const [showActionSheet, setShowActionSheet] = React.useState(false);

	const { isOpen, onOpen, onClose } = useDisclose();


	const pageSize = 20;
	let newPage = page +1;

	React.useLayoutEffect(() => {
		navigation.setOptions({
			headerLeft: () => <Box />,
		});
	}, [navigation]);

	const { status, data, error, isFetching} = useQuery(
		['all_campaigns', library.baseUrl, language, filterBy], () => fetchCampaigns(page, pageSize, filterBy, library.baseUrl), {
			initialData: campaigns,
			keepPreviousData: true,
			staleTime: 1000,
			onSuccess: (data) => {
				updateCampaigns(data?.campaigns ?? []);
			
				const statusMap = {};
				data.campaigns.forEach(campaign => {
					statusMap[campaign.id] = campaign.enrolled;
					statusMap[campaign.id] = campaign.emailOptIn;
				});
				setEnrollmentStatus(statusMap);
				setEmailNotificationStatus(statusMap);
				
			},
		  onSettle: () => setLoading(false),  
		}
	);

	useEffect(() => {
		queryClient.invalidateQueries(['all_campaigns']);
	}, [filterBy]);

	const calculateProgress = (completed, total) => {
		const progressFraction = `${completed}/${total}`;
		const progressPercentage = total == 0 ? 0 : ((completed / total) * 100).toFixed(2);
		return { progressFraction, progressPercentage };
	  };

	const handleEnrollUnenroll = async (campaignId, linkedUserId = null) => {
		setLoading(true);
		try {
			const isEnrolled = enrollmentStatus[campaignId];
			const action = isEnrolled ? unenrollCampaign : enrollCampaign;
			const userId = filterBy === 'linkedUserCampaigns' ? linkedUserId : user.id;

			await action (campaignId, userId, library.baseUrl, language);


			setEnrollmentStatus((prev) => ({
				...prev,
				[campaignId]: !isEnrolled,
			}));
			queryClient.invalidateQueries({ queryKey: ['all_campaigns']});
		} catch (error) {
			console.error("Error enrolling/unenrolling", error);
		} finally {
			setLoading(false);
		}
	};

	const handleEmailNotificationOptions = async (campaignId, linkedUserId = null) => {
		setLoading(true);
		try {
			const isOptedIn = emailNotificationStatus[campaignId];
			const action = isOptedIn ? optOutOfEmails : optInToEmails;
			const userId = filterBy === 'linkedUserCampaigns' ? linkedUserId : user.id;

			await action (campaignId, userId, library.baseUrl, language);


			setEmailNotificationStatus((prev) => ({
				...prev,
				[campaignId]: !isOptedIn,
			}));
			queryClient.invalidateQueries({ queryKey: ['all_campaigns']});
		} catch (error) {
			console.error("Error updating email preferences", error);
		} finally {
			setLoading(false);
		}
	}
	
	const toggleCampaignInfo = (campaignId) => {
		setOpenCampaignInfo(prevState => ({
			...prevState, 
			[campaignId]: !prevState[campaignId],
		}));
	};

	const toggleExpanded = (id) => {
		setExpandedCampaigns((prev) => ({
			...prev,
			[id]: !prev[id],
		}));
	}


	const handleOpenActions = (item) => {
		console.log('Action button clicked for: ', item);
		setSelectedCampaign(item);
		setShowActionSheet(true);
		console.log('Show ActionSheet:', showActionSheet);
	}

	const handleCloseActions = () => {
		setShowActionSheet(false);
	}

	const handleToggleEnrollment = () => {
		console.log('Toggling enrollment for', selectedCampaign?.name);
		onClose();
	};
	
	const handleToggleNotifications = () => {
		console.log('Toggling notifications for', selectedCampaign?.name);
		onClose();
	};
	
	const handleToggleLeaderboard = () => {
		console.log('Toggling leaderboard for', selectedCampaign?.name);
		onClose();
	};


	const renderCampaignItem = ({ item, onOpenActions, onToggle, expanded }) => {
		console.log(onOpenActions);
		if (!item) return null;

		const isEnrolled = item.enrolled;
		const startDate = item.startDate ? new Date(item.startDate).toLocaleDateString() : 'N/A';
		const endDate = item.endDate ? new Date(item.endDate).toLocaleDateString() : 'N/A';
		const campaignRewardName = item.rewardName ?? 'No Reward';
		const campaignImageUrl = String(library.baseUrl + item.badgeImage);


		return (
			<VStack space={2} px={4} py={3}>
			<HStack justifyContent="space-between" borderBottomWidth={1} pb={2}>
				<Text flex={2} bold>Campaign Name</Text>
				<Text flex={3} bold>Reward</Text>
				<Text flex={2} bold>Dates</Text>
				<Text flex={1} bold></Text>
				<Text flex={1} bold></Text>
			</HStack>
			
			<HStack
				key={item.id}
				justifyContent="space-between"
				alignItems="center"
				py={2}
				borderBottomWidth={0.5}
				borderColor="coolGray.200"
			>
				<Text flex={2}>{item.name}</Text>
				<Box flex={3}>
					{item.displayName == 1 && (
						<Text color="emerald.600">{campaignRewardName}</Text>
					)}
					{item.rewardType == 1 && item.rewardExists == 1 && item.badgeImage && (
						<Image
						source={{ uri: campaignImageUrl }}
						alt={ item.rewardName }
						contentFit="contain"
						style={{ width: 100, height: 100 }}
						/>
					)}
				</Box>
				<Text flex={2} color="gray.500">{`${startDate} - ${endDate}`}</Text>
				<Button
					onPress={onToggle}
					variant="ghost"
					flex={1}
					aria-label={expanded ? "Collapse campaign details" : "Expand campaign details"}
				>
					{expanded ? <ChevronUpIcon size="4" /> :  <ChevronDownIcon size="4" />}
				</Button>
				<Button 
					size="sm"
					flex={1}
					onPress={() => onOpenActions(item)}
					aria-label='Open actions menu for this ${item.name}'>
						Actions
				</Button>
			</HStack>

			{expanded && (
				<Box px={2} py={2} bg="coolGray.100" borderRadius="md">
					{(item.milestones ?? []). length > 0 ? (
						<VStack space={2}>
							<HStack justifyContent="space-between" pb={1} borderBottomWidth={1}>
								<Text flex={2} bold>Name</Text>
								<Text flex={1} bold>Goal</Text>
								<Text flex={1} bold>Reward</Text>
							</HStack>

							{item.milestones.map((milestone, i) => {
								const imageUrl = String(library.baseUrl + milestone.rewardImage);
								
								return(
									<HStack 
										key={i} 
										justifyContent="space-between"
										alignItems="center"
									>
										<Text flex={2}>{milestone.name}</Text>
										<Text flex={1}>{milestone.completedGoals} / {milestone.totalGoals}</Text>
										<Box flex={1}>
											{milestone.displayName == 1 && (
												<Text>{milestone.rewardName}</Text>

											)}
											{milestone.rewardType == 1 && milestone.rewardExists == 1 && milestone.rewardImage && (
												<Image
												source={{ uri: imageUrl }}
												contentFit="contain"
												style={{ width: 100, height: 100 }}
												alt={ milestone.rewardName }
												/>
											)}
										</Box>

									
								</HStack>
							);
						})}
						</VStack>
					) : (
						<Text color="gray.400" italic>No milestones available</Text>
					)}
				</Box>
			)}

			{/* {showActionSheet && ( */}
			<Actionsheet isOpen={showActionSheet} onClose={handleCloseActions}>
				<Actionsheet.Content>
						<Actionsheet.Item onPress={() => console.log('enroll')}>enroll</Actionsheet.Item>
						<Actionsheet.Item onPress={() => console.log('Opten in to Noticifactions')}>Notifications</Actionsheet.Item>
						<Actionsheet.Item onPress={() => console.log('Opten in to Leaderboard')}>Leaderbaord</Actionsheet.Item>
						<Actionsheet.Item onPress={handleCloseActions}>Cancel</Actionsheet.Item>
				</Actionsheet.Content>
			</Actionsheet>
			{/* )} */}
			</VStack>
		);
	};

	const Empty = () => (
		<Center mt={5} mb={5}>
			<Text bold fontSize="lg">
				{filterBy === 'active'
					? getTermFromDictionary(language, 'no_active_campaigns')
					: filterBy === 'enrolled'
					? getTermFromDictionary(language, 'no_enrolled_campaigns')
					: filterBy === 'past'
					? getTermFromDictionary(language, 'no_past_campaigns')
					: filterBy === 'upcoming'
					? getTermFromDictionary(language, 'no_upcoming_campaigns')
					: filterBy === 'pastEnrolled'
					? getTermFromDictionary(language, 'no_past_enrolled_campaigns')
					: filterBy === 'linkedUserCampaigns'
					? getTermFromDictionary(language, 'no_linked_user_campaigns')
					: getTermFromDictionary(language, 'no_campaigns')
				}
			</Text>
		</Center>
	);

		
		return (
			<SafeAreaView style={{ flex: 1 }}>
				<Box alignItems="center" safeArea={2} bgColor="coolGray.100" borderBottomWidth="1">
					<Select
					selectedValue={filterBy}
					minWidth="200"
					accessibilityLabel="Filter Campaigns"
					placeholder="Select Filter"
					_selectedItem={{
						bg: "teal.600",
						endIcon: <CheckIcon size="5" />,
					}}
					mt={1}
					onValueChange={(itemValue) => setFilterBy(itemValue)}>
					<Select.Item label={getTermFromDictionary(language, 'enrolled_campaigns')} value="enrolled" />
					<Select.Item label={getTermFromDictionary(language, 'linked_user_campaigns')} value="linkedUserCampaigns" />
					<Select.Item label={getTermFromDictionary(language, 'active_campaigns')} value="active" />
					<Select.Item label={getTermFromDictionary(language, 'upcoming_campaigns')} value="upcoming" />
					<Select.Item label={getTermFromDictionary(language, 'past_campaigns')} value="past" />
					<Select.Item label={getTermFromDictionary(language, 'past_enrolled_campaigns')} value="pastEnrolled" />
					</Select>
				</Box>

				{status === 'loading' || isFetching ? (
					<Text>Loading...</Text>
				) : status === 'error' ? (
					<Text>Error loading campaigns</Text>
				) : (
					<FlatList
					data={data?.campaigns ?? []}
					ListEmptyComponent={Empty}
					renderItem={({ item }) =>
						renderCampaignItem({
							item,
							expanded: expandedCampaigns[item.id],
							onToggle: () => toggleExpanded(item.id),
							onOpenActions: handleOpenActions,
						})
					}
					keyExtractor={(item, index) => index.toString()}
					contentContainerStyle={{ paddingBottom: 30 }}
					/>
				)}
			</SafeAreaView>
		); 
}