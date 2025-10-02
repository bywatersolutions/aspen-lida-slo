import React from 'react';
import _ from 'lodash';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Heading, Box, Button, ButtonText, ButtonGroup, ScrollView, Text, VStack } from '@gluestack-ui/themed';

export const NotificationHistoryMessageModal = () => {
     const navigation = useNavigation();
     const defaultMessage = {
          title: '',
          content: '',
          isRead: 0,
          dateSent: null,
     };

     const route = useRoute();
     const message = route.params?.message ?? defaultMessage;

     const formatDate = (timestamp) => {
          if (!timestamp) return '';
          // Convert Unix timestamp (seconds) to milliseconds
          const date = new Date(timestamp * 1000);
          return date.toLocaleDateString(undefined, {
               year: 'numeric',
               month: 'long',
               day: 'numeric',
               hour: '2-digit',
               minute: '2-digit'
          });
     };

     return (
          <ScrollView>
               <Box p="$5">
                    <VStack space="md">
                         <Heading size="lg">{message.title}</Heading>
                         <Text>{message.content}</Text>
                         {message.dateSent && (
                              <Text size="sm" opacity={0.7}>
                                   {formatDate(message.dateSent)}
                              </Text>
                         )}
                    </VStack>
               </Box>
          </ScrollView>
     );
};