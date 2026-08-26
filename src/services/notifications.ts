import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { QAEntry } from '../types';
import { plainText } from '../utils/linkText';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('billwurtz', {
      name: 'Bill Wurtz Updates',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function notifyNewQuestions(count: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'bill wurtz updated!',
      body: `${count} new answer${count !== 1 ? 's' : ''} on the questions page`,
      sound: 'default',
    },
    trigger: null,
  });
}

export async function notifyQuestionMatched(watchedText: string, entry: QAEntry): Promise<void> {
  const answerText = plainText(entry.answer);
  const preview = answerText.length > 120
    ? answerText.slice(0, 120) + '...'
    : answerText;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'bill answered your question!',
      body: preview || watchedText,
      sound: 'default',
    },
    trigger: null,
  });
}
