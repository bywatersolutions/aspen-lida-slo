import React from 'react';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { ActionsheetIcon, ActionsheetItem, ActionsheetItemText, Icon, useToken } from '@gluestack-ui/themed';
import { LanguageContext } from '../../../context/initialContext';
import { freezeHold, freezeHolds } from '../../../util/accountActions';
import { getTermFromDictionary } from '../../../translations/TranslationService';

export const SelectThawDate = (props) => {
     const { freezingLabel, freezeLabel, label, libraryContext, onClose, freezeId, recordId, source, userId, resetGroup, showActionsheet, textColor, colorMode } = props;
     let data = props.data;
     const { language } = React.useContext(LanguageContext);
     const [loading, setLoading] = React.useState(false);

     let actionLabel = freezeLabel;
     if (label) {
          actionLabel = label;
     }

     const today = new Date();
     const [date, setDate] = React.useState(today);

     const [isDatePickerVisible, setDatePickerVisibility] = React.useState(false);

     const showDatePicker = () => {
          setDatePickerVisibility(true);
     };

     const hideDatePicker = () => {
          setDatePickerVisibility(false);
     };

     const onSelectDate = (date) => {
          hideDatePicker();
          setLoading(true);
          console.warn('A date has been picked: ', date);
          setDate(date);
          onClose();
          if (data) {
               freezeHolds(data, libraryContext.baseUrl, date, language, libraryContext.reactivateDateNotRequired ?? false).then((result) => {
                    setLoading(false);
                    resetGroup();
                    hideDatePicker();
               });
          } else {
               freezeHold(freezeId, recordId, source, libraryContext.baseUrl, userId, date, language, libraryContext.reactivateDateNotRequired ?? false).then((result) => {
                    setLoading(false);
                    resetGroup();
                    hideDatePicker();
               });
          }
     };

     return (
          <>
               <ActionsheetItem onPress={showDatePicker}>
                    {data ? null : <ActionsheetIcon>
                         <Icon as={MaterialIcons} name="pause" mr="$1" size="md"  color={textColor}/>
                    </ActionsheetIcon> }
                    <ActionsheetItemText color={textColor}>{actionLabel}</ActionsheetItemText>
               </ActionsheetItem>
               <DateTimePickerModal isVisible={isDatePickerVisible} date={date} mode="date" onConfirm={onSelectDate} onCancel={hideDatePicker} isDarkModeEnabled={colorMode === "dark"} minimumDate={today} textColor={textColor} confirmTextIOS={loading ? freezingLabel : actionLabel} />
          </>
     );
};