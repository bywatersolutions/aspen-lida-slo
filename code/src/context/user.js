import React, {createContext} from 'react';

const userContext = createContext({
	user: [],
	location: [],
	library: [],
	browseCategories: [],
	pushToken: null,
	notificationSettings: {
		notifySavedSearch: { option: 'notifySavedSearch', label: 'Saved Searches' },
		notifyCustom: { option: 'notifyCustom', label: 'Library Updates' },
		notifyAccount: { option: 'notifyAccount', label: 'Account Updates' }
	},
	updateUser: () => {},
	updateBrowseCategories: () => {},
	updateNotificationSettings: () => {},
});

export { userContext };