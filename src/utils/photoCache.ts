// Photo cache utility for persistent image caching
class PhotoCache {
  private cache = new Map<string, string>();
  private readonly CACHE_KEY_PREFIX = 'truck_photo_';
  private readonly BACKUP_KEY_PREFIX = 'truck_photo_backup_';
  private readonly MAX_CACHE_SIZE = 50; // Maximum number of cached photos

  // Get cached photo URL
  getCachedPhoto(photoURL: string): string | null {
    const cacheKey = this.getCacheKey(photoURL);
    return this.cache.get(cacheKey) || localStorage.getItem(cacheKey);
  }

  // Cache photo URL
  setCachedPhoto(photoURL: string, cachedURL: string): void {
    const cacheKey = this.getCacheKey(photoURL);
    
    // Add to memory cache
    this.cache.set(cacheKey, cachedURL);
    
    // Add to localStorage for persistence
    try {
      localStorage.setItem(cacheKey, cachedURL);
    } catch (error) {
      console.warn('Failed to cache photo to localStorage:', error);
    }

    // Clean up old cache entries if we exceed max size
    this.cleanupCache();
  }

  // Check if photo is cached
  isCached(photoURL: string): boolean {
    const cacheKey = this.getCacheKey(photoURL);
    return this.cache.has(cacheKey) || localStorage.getItem(cacheKey) !== null;
  }

  // Remove cached photo
  removeCachedPhoto(photoURL: string): void {
    const cacheKey = this.getCacheKey(photoURL);
    this.cache.delete(cacheKey);
    localStorage.removeItem(cacheKey);
  }

  // Clear all cached photos
  clearCache(): void {
    this.cache.clear();
    
    // Clear localStorage entries
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }

  // Get cache key for photo URL
  private getCacheKey(photoURL: string): string {
    // Create a hash of the URL for the cache key
    let hash = 0;
    for (let i = 0; i < photoURL.length; i++) {
      const char = photoURL.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${this.CACHE_KEY_PREFIX}${Math.abs(hash)}`;
  }

  // Clean up old cache entries
  private cleanupCache(): void {
    if (this.cache.size <= this.MAX_CACHE_SIZE) {
      return;
    }

    // Remove oldest entries (simple FIFO)
    const entries = Array.from(this.cache.entries());
    const toRemove = entries.slice(0, entries.length - this.MAX_CACHE_SIZE);
    
    toRemove.forEach(([key, _]) => {
      this.cache.delete(key);
      localStorage.removeItem(key);
    });
  }

  // Preload photo for better performance
  async preloadPhoto(photoURL: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        // Photo loaded successfully, cache it
        this.setCachedPhoto(photoURL, photoURL);
        resolve(photoURL);
      };
      
      img.onerror = () => {
        reject(new Error(`Failed to preload photo: ${photoURL}`));
      };
      
      img.src = photoURL;
    });
  }

  // Get cache statistics
  getCacheStats(): { memoryCache: number; localStorageCache: number; total: number } {
    const memoryCache = this.cache.size;
    const localStorageCache = Object.keys(localStorage)
      .filter(key => key.startsWith(this.CACHE_KEY_PREFIX))
      .length;
    
    return {
      memoryCache,
      localStorageCache,
      total: memoryCache + localStorageCache
    };
  }

  // Force refresh a photo (remove from cache and reload)
  forceRefresh(photoURL: string): void {
    this.removeCachedPhoto(photoURL);
  }

  // Check if cache is working properly
  isCacheWorking(): boolean {
    try {
      const testKey = this.CACHE_KEY_PREFIX + 'test';
      localStorage.setItem(testKey, 'test');
      const result = localStorage.getItem(testKey) === 'test';
      localStorage.removeItem(testKey);
      return result;
    } catch {
      return false;
    }
  }

  // ===== Photo URL Backup System (by Unit Number) =====
  // Save photo URL backup keyed by unit number (for fallback when Firestore loses it)
  savePhotoURLBackup(unitNumber: string, photoURL: string): void {
    if (!photoURL || !unitNumber) return;
    
    const backupKey = `${this.BACKUP_KEY_PREFIX}${unitNumber}`;
    try {
      localStorage.setItem(backupKey, photoURL);
      console.log(`[PhotoCache] Saved photo URL backup for Unit ${unitNumber}`);
    } catch (error) {
      console.warn(`[PhotoCache] Failed to save photo URL backup for Unit ${unitNumber}:`, error);
    }
  }

  // Get photo URL backup for a unit number
  getPhotoURLBackup(unitNumber: string): string | null {
    if (!unitNumber) return null;
    
    const backupKey = `${this.BACKUP_KEY_PREFIX}${unitNumber}`;
    try {
      const backupURL = localStorage.getItem(backupKey);
      if (backupURL) {
        console.log(`[PhotoCache] Found photo URL backup for Unit ${unitNumber}`);
      }
      return backupURL;
    } catch (error) {
      console.warn(`[PhotoCache] Failed to get photo URL backup for Unit ${unitNumber}:`, error);
      return null;
    }
  }

  // Remove photo URL backup (when truck is deleted or photo is intentionally removed)
  removePhotoURLBackup(unitNumber: string): void {
    if (!unitNumber) return;
    
    const backupKey = `${this.BACKUP_KEY_PREFIX}${unitNumber}`;
    try {
      localStorage.removeItem(backupKey);
      console.log(`[PhotoCache] Removed photo URL backup for Unit ${unitNumber}`);
    } catch (error) {
      console.warn(`[PhotoCache] Failed to remove photo URL backup for Unit ${unitNumber}:`, error);
    }
  }

  // Clear all photo URL backups
  clearPhotoURLBackups(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.BACKUP_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      console.log('[PhotoCache] Cleared all photo URL backups');
    } catch (error) {
      console.warn('[PhotoCache] Failed to clear photo URL backups:', error);
    }
  }
}

// Export singleton instance
export const photoCache = new PhotoCache();

// Export class for testing
export { PhotoCache };
