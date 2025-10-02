import React from 'react';
import * as Notifications from 'expo-notifications';
import { AppState, Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import _ from 'lodash';
import { createChannelsAndCategories, deletePushToken, getNotificationPreference, registerForPushNotificationsAsync, savePushToken, setNotificationPreference } from '../components/Notifications';

// Configure default notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export const useNotificationPermissions = (library, user, updateExpoToken, updateAspenToken) => {
    const [permissionStatus, setPermissionStatus] = React.useState(false);
    const [isLoading, setLoading] = React.useState(false);
    const appState = React.useRef(AppState.currentState);
    const notificationListener = React.useRef();
    const responseListener = React.useRef();
    const lastCheckedStatus = React.useRef(false);

    const checkAndUpdatePermissions = async (force = false) => {
        try {
            const { status } = await Notifications.getPermissionsAsync();
            const isGranted = status === 'granted';

            // Only update if status has changed or force update is requested
            if (force || lastCheckedStatus.current !== isGranted) {
                lastCheckedStatus.current = isGranted;
                setPermissionStatus(isGranted);

                // Clear tokens if permissions are revoked
                if (!isGranted) {
                    updateExpoToken(null);
                    updateAspenToken(false);
                }
            }
            return isGranted;
        } catch (error) {
            console.error('Error checking permissions:', error);
            return false;
        }
    };

    // Function to handle simulator test notifications
    const scheduleTestNotification = async () => {
        if (!Device.isDevice) {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "Test Notification",
                    body: "This is a test notification in the simulator",
                    data: { type: 'test' },
                },
                trigger: { seconds: 2 },
            });
        }
    };

    React.useEffect(() => {
        const checkPermissions = async () => {
            const isGranted = await checkAndUpdatePermissions(true);
            if (!isGranted) {
                // If permissions are not granted, ensure tokens are cleared
                updateExpoToken(null);
                updateAspenToken(false);
            }
        };

        checkPermissions();

        // Set up notification listeners
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            console.log('Received notification:', notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('Notification response:', response);
        });

        const subscription = AppState.addEventListener('change', async (nextAppState) => {
            if (nextAppState === 'active') {
                await checkAndUpdatePermissions(true);
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
            if (notificationListener.current) {
                Notifications.removeNotificationSubscription(notificationListener.current);
            }
            if (responseListener.current) {
                Notifications.removeNotificationSubscription(responseListener.current);
            }
        };
    }, []);

    const handlePermissionGranted = async () => {
        const token = (await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig.extra.eas.projectId,
        })).data;

        if (token && !_.isEmpty(user.notification_preferences)) {
            const tokenStorage = user.notification_preferences;
            if (_.find(tokenStorage, _.matchesProperty('token', token))) {
                updateAspenToken(true);
                updateExpoToken(token);
            }
        }
    };

    const addNotificationPermissions = async () => {
        try {
            setLoading(true);
            await createChannelsAndCategories();
            const result = await registerForPushNotificationsAsync(library.baseUrl);

            if (result) {
                await savePushToken(library.baseUrl, result);
                updateExpoToken(result);
                updateAspenToken(true);
                await checkAndUpdatePermissions(); // Update permission status after successful registration
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error adding notification permissions:', error);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const revokeNotificationPermissions = async () => {
        try {
            setLoading(true);

            // Get current token before revoking
            const tokenData = !Device.isDevice
                ? { data: 'simulator-test-token' }
                : await Notifications.getExpoPushTokenAsync({
                    projectId: Constants.expoConfig.extra.eas.projectId,
                });

            if (tokenData?.data) {
                // Delete the token from the server first
                await deletePushToken(library.baseUrl, tokenData.data);

                // Clear preferences
                await setNotificationPreference(library.baseUrl, tokenData.data, 'notifySavedSearch', false, false);
                await setNotificationPreference(library.baseUrl, tokenData.data, 'notifyCustom', false, false);
                await setNotificationPreference(library.baseUrl, tokenData.data, 'notifyAccount', false, false);
            }

            // Update local state
            updateExpoToken(null);
            updateAspenToken(false);
            lastCheckedStatus.current = false;
            setPermissionStatus(false);

            // Clear badges
            await Notifications.setBadgeCountAsync(0);

            // Handle platform-specific settings navigation
            if (Platform.OS === 'android') {
                try {
                    // Try to open app settings directly first
                    await Linking.openSettings();
                } catch (err) {
                    console.error('Error opening Android settings:', err);
                    // If that fails, try opening through the system settings
                    try {
                        await Linking.openURL('android-settings://');
                    } catch (secondErr) {
                        console.error('Failed to open settings through alternative method:', secondErr);
                    }
                }
            } else if (Platform.OS === 'ios') {
                await Linking.openSettings();
            }

            // Set up a listener for when the app comes back to foreground
            const subscription = AppState.addEventListener('change', async (nextAppState) => {
                if (nextAppState === 'active') {
                    // Small delay to ensure Android has time to update permission state
                    setTimeout(async () => {
                        await checkAndUpdatePermissions(true);
                        subscription.remove();
                    }, 1000);
                }
            });
        } catch (error) {
            console.error('Error revoking notification permissions:', error);
            await checkAndUpdatePermissions(true);
        } finally {
            setLoading(false);
        }
    };

    // Add an effect to check permissions status on mount and when app comes to foreground
    React.useEffect(() => {
        checkAndUpdatePermissions();

        const subscription = AppState.addEventListener('change', async (nextAppState) => {
            if (nextAppState === 'active') {
                await checkAndUpdatePermissions();
            }
        });

        return () => subscription.remove();
    }, []);

    return {
        permissionStatus,
        isLoading,
        addNotificationPermissions,
        revokeNotificationPermissions,
        checkAndUpdatePermissions
    };
};

export const useNotificationPreferences = (library, expoToken) => {
    const [preferences, setPreferences] = React.useState({
        notifySavedSearch: false,
        notifyCustom: false,
        notifyAccount: false,
    });

    const updatePreference = async (option, value) => {
        try {
            await setNotificationPreference(library.baseUrl, expoToken, option, value);
            setPreferences(prev => ({ ...prev, [option]: value }));
        } catch (error) {
            console.error(`Error updating ${option} preference:`, error);
        }
    };

    const loadPreferences = async () => {
        try {
            const [savedSearch, custom, account] = await Promise.all([
                getNotificationPreference(library.baseUrl, expoToken, 'notifySavedSearch'),
                getNotificationPreference(library.baseUrl, expoToken, 'notifyCustom'),
                getNotificationPreference(library.baseUrl, expoToken, 'notifyAccount'),
            ]);

            setPreferences({
                notifySavedSearch: savedSearch?.allow ?? false,
                notifyCustom: custom?.allow ?? false,
                notifyAccount: account?.allow ?? false,
            });
        } catch (error) {
            console.error('Error loading notification preferences:', error);
        }
    };

    return {
        preferences,
        updatePreference,
        loadPreferences,
    };
};
