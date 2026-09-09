export function getExperienceBookmarkActionKey(authenticated: boolean, bookmarked: boolean): string {
  if (!authenticated) return 'common.experiences.loginToSave';
  return bookmarked ? 'common.experiences.removeSaved' : 'common.experiences.save';
}
