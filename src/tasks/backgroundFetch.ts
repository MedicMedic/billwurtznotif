import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { fetchQuestions } from '../services/scraper';
import {
  getSeenIds,
  addSeenIds,
  prependNewEntries,
  getAllEntries,
  saveAllEntries,
  getWatched,
  saveWatched,
  setLastCheck,
  isInitialized,
  markInitialized,
} from '../services/storage';
import { notifyNewQuestions, notifyQuestionMatched } from '../services/notifications';
import { matchesEntry } from '../services/matching';

export const TASK_NAME = 'billwurtz-bg-fetch';

// Must be defined at module top level for Expo task manager
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await runCheck();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function runCheck(): Promise<{ newCount: number }> {
  const now = Date.now();
  await setLastCheck(now);

  const entries = await fetchQuestions();
  const seenIds = await getSeenIds();
  const initialized = await isInitialized();

  // Carry over "detected" timestamps so a new entry keeps its badge across checks.
  const prevDetected = new Map(
    (await getAllEntries()).map(e => [e.id, e.detectedAt])
  );
  const withTimestamps = entries.map(e => {
    const carried = prevDetected.get(e.id);
    const isNew = initialized && !seenIds.has(e.id);
    return { ...e, detectedAt: carried ?? (isNew ? now : undefined) };
  });

  // Always persist the full current page so the feed reflects the live site.
  await saveAllEntries(withTimestamps);

  if (!initialized) {
    // First run: snapshot current page as seen so we only notify about truly new things.
    await addSeenIds(entries.map(e => e.id));
    await markInitialized();
    return { newCount: 0 };
  }

  const newEntries = withTimestamps.filter(e => !seenIds.has(e.id));
  if (newEntries.length === 0) return { newCount: 0 };

  await addSeenIds(newEntries.map(e => e.id));
  await prependNewEntries(newEntries);
  await notifyNewQuestions(newEntries.length);

  // Check each watched question for keyword matches in the new entries
  const watched = await getWatched();
  let watchedDirty = false;

  for (const wq of watched) {
    if (wq.matched) continue;

    for (const entry of newEntries) {
      if (matchesEntry(wq, entry)) {
        wq.matched = true;
        wq.matchedEntry = entry;
        await notifyQuestionMatched(wq.text, entry);
        watchedDirty = true;
        break;
      }
    }
  }

  if (watchedDirty) await saveWatched(watched);

  return { newCount: newEntries.length };
}

export async function registerBackgroundFetch(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return;
    }

    const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (!alreadyRegistered) {
      await BackgroundFetch.registerTaskAsync(TASK_NAME, {
        // Check about once an hour while the app is closed; the OS may batch/
        // defer this, but the page only updates a few times a day so that's plenty.
        minimumInterval: 60 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch (err) {
    console.warn('Background fetch registration failed:', err);
  }
}
