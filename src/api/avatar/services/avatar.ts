/**
 * Avatar Service
 * Provides list of available avatars with their URLs
 */

export default () => ({
  /**
   * Get list of all available avatars
   * @returns Array of avatar objects with id, name, and url
   */
  getAvailableAvatars() {
    const avatars = [
      { id: 'lion', name: 'Lion', url: '/avatars/lion.svg' },
      { id: 'cat', name: 'Cat', url: '/avatars/cat.svg' },
      { id: 'panda', name: 'Panda', url: '/avatars/panda.svg' },
      { id: 'wolf', name: 'Wolf', url: '/avatars/wolf.svg' },
      { id: 'fox', name: 'Fox', url: '/avatars/fox.svg' },
      { id: 'bear', name: 'Bear', url: '/avatars/bear.svg' },
      { id: 'tiger', name: 'Tiger', url: '/avatars/tiger.svg' },
      { id: 'owl', name: 'Owl', url: '/avatars/owl.svg' },
    ];

    return avatars;
  },

  /**
   * Check if avatar ID is valid
   * @param avatarId - The avatar ID to validate
   * @returns boolean - true if valid, false otherwise
   */
  isValidAvatarId(avatarId: string): boolean {
    const avatars = this.getAvailableAvatars();
    return avatars.some(avatar => avatar.id === avatarId);
  },

  /**
   * Get avatar URL by ID
   * @param avatarId - The avatar ID
   * @returns string - The avatar URL or default lion
   */
  getAvatarUrl(avatarId: string): string {
    const avatars = this.getAvailableAvatars();
    const avatar = avatars.find(a => a.id === avatarId);
    return avatar ? avatar.url : '/avatars/lion.svg';
  }
});
