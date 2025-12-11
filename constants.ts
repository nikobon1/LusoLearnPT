import { UserProfile, Folder } from './types';

export const INITIAL_USER: UserProfile = {
  xp: 0,
  level: 1,
  streak: 0,
  lastStudyDate: new Date().toISOString(),
  cardsLearned: 0,
  learningHistory: {}
};

export const DEFAULT_FOLDER: Folder = { id: 'default', name: 'Общее' };
