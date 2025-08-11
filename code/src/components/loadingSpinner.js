import React from 'react';
import { Center, Heading, HStack, VStack, Spinner } from '@gluestack-ui/themed';
import { ThemeContext } from '../context/initialContext';

/*
TODO: Translate the accessibility labels
*/

export function loadingSpinner(message = '') {
     const { colorMode, theme, textColor } = React.useContext(ThemeContext);

     if (message !== '') {
          return (
               <Center flex={1} px="3">
                    <VStack space="sm" alignItems="center">
                         <Spinner size="large" accessibilityLabel="Loading..." color={theme['colors']['primary']['500']}/>
                         <Heading size="md" color={textColor}>{message}</Heading>
                    </VStack>
               </Center>
          );
     }

     return (
          <Center flex={1}>
               <HStack>
                    <Spinner size="large" color={theme['colors']['primary']['500']} accessibilityLabel="Loading..." />
               </HStack>
          </Center>
     );
}

export const LoadingSpinner = ({ message }) => {
     const { colorMode, theme, textColor } = React.useContext(ThemeContext);
     if (message && message !== '') {
          return (
               <Center flex={1} px="$3">
                    <VStack space="md" alignItems="center">
                         <Spinner size="lg" color={theme['colors']['primary']['500']} accessibilityLabel="Loading..." />
                         <Heading size="md" color={textColor}>
                              {message}
                         </Heading>
                    </VStack>
               </Center>
          );
     }

     return (
          <Center flex={1}>
               <HStack>
                    <Spinner color={theme['colors']['primary']['500']} size="large" accessibilityLabel="Loading..." />
               </HStack>
          </Center>
     );
};
