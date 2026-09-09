import { getExperienceBookmarkActionKey } from './experience-bookmark-action';

describe('getExperienceBookmarkActionKey', () => {
  it('describes the login requirement for guests', () => {
    expect(getExperienceBookmarkActionKey(false, false)).toBe('common.experiences.loginToSave');
  });

  it('offers to save an unsaved experience for authenticated users', () => {
    expect(getExperienceBookmarkActionKey(true, false)).toBe('common.experiences.save');
  });

  it('offers to remove a saved experience for authenticated users', () => {
    expect(getExperienceBookmarkActionKey(true, true)).toBe('common.experiences.removeSaved');
  });
});
