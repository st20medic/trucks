import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Truck, MaintenanceRecord } from '../types';
import { subscribeToTrucks, subscribeToMaintenance } from '../services/firebase';
import { photoCache } from '../utils/photoCache';

interface TruckContextType {
  trucks: Truck[];
  maintenanceRecords: MaintenanceRecord[];
  loading: boolean;
  error: string | null;
}

const TruckContext = createContext<TruckContextType | undefined>(undefined);

export const useTrucks = () => {
  const context = useContext(TruckContext);
  if (context === undefined) {
    throw new Error('useTrucks must be used within a TruckProvider');
  }
  return context;
};

interface TruckProviderProps {
  children: ReactNode;
}

export const TruckProvider: React.FC<TruckProviderProps> = ({ children }) => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trucksLoaded, setTrucksLoaded] = useState(false);
  const [maintenanceLoaded, setMaintenanceLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Detect online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Detect if device is mobile
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // Get appropriate timeout based on device type
  const getTimeoutDuration = () => {
    return isMobile() ? 15000 : 8000; // 15 seconds for mobile, 8 seconds for desktop
  };

  const setupSubscriptions = () => {
    console.log('TruckContext: Setting up truck data subscription');
    console.log('TruckContext: Device type:', isMobile() ? 'Mobile' : 'Desktop');
    console.log('TruckContext: Network status:', isOnline ? 'Online' : 'Offline');
    
    if (!isOnline) {
      setError('No internet connection. Please check your network and try again.');
      setLoading(false);
      return { unsubscribeTrucks: () => {}, unsubscribeMaintenance: () => {} };
    }
    
    const unsubscribeTrucks = subscribeToTrucks((trucks) => {
      console.log('TruckContext: Firebase trucks data received:', trucks.length, 'trucks');
      setTrucks(trucks);
      setTrucksLoaded(true);
      setError(null);
      setRetryCount(0); // Reset retry count on success
      
      // Save photo URLs to backup and preload photos
      trucks.forEach(truck => {
        // Save photo URL to backup if it exists (for future restoration if lost)
        if (truck.photoURL && truck.unitNumber) {
          photoCache.savePhotoURLBackup(truck.unitNumber, truck.photoURL);
        }
        
        // Preload photos for better performance (only if not already cached)
        if (truck.photoURL && !photoCache.isCached(truck.photoURL)) {
          // Preload in background without blocking UI
          photoCache.preloadPhoto(truck.photoURL).catch(() => {
            // Silently fail - the TruckPhoto component will handle loading
          });
        }
      });
      
      // Set loading to false once both subscriptions are complete
      if (maintenanceLoaded) {
        setLoading(false);
      }
    }, (error) => {
      console.error('TruckContext: Error loading trucks:', error);
      setError(error.message || 'Failed to load trucks');
      setTrucksLoaded(true);
      setLoading(false);
    });
    
    const unsubscribeMaintenance = subscribeToMaintenance((records) => {
      console.log('TruckContext: Firebase maintenance data received:', records.length, 'records');
      setMaintenanceRecords(records);
      setMaintenanceLoaded(true);
      
      // Set loading to false once both subscriptions are complete
      if (trucksLoaded) {
        setLoading(false);
      }
    }, (error) => {
      console.error('TruckContext: Error loading maintenance:', error);
      setError(error.message || 'Failed to load maintenance records');
      setMaintenanceLoaded(true);
      setLoading(false);
    });

    // Ensure we always return valid unsubscribe functions
    return { 
      unsubscribeTrucks: unsubscribeTrucks || (() => {}), 
      unsubscribeMaintenance: unsubscribeMaintenance || (() => {}) 
    };
  };

  useEffect(() => {
    let unsubscribeTrucks: (() => void) | null = null;
    let unsubscribeMaintenance: (() => void) | null = null;
    
    const initializeData = () => {
      const subscriptions = setupSubscriptions();
      if (subscriptions) {
        unsubscribeTrucks = subscriptions.unsubscribeTrucks;
        unsubscribeMaintenance = subscriptions.unsubscribeMaintenance;
      }
    };

    initializeData();

    // Set a timeout to prevent infinite loading if Firebase doesn't respond
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.log('TruckContext: Loading timeout reached, setting loading to false');
        setLoading(false);
        
        if (retryCount < 2) {
          // Retry once more
          setRetryCount(prev => prev + 1);
          setError(`Connection timeout. Retrying... (${retryCount + 1}/2)`);
          
          // Retry after a short delay
          setTimeout(() => {
            if (unsubscribeTrucks) unsubscribeTrucks();
            if (unsubscribeMaintenance) unsubscribeMaintenance();
            initializeData();
          }, 2000);
        } else {
          setError('Loading timeout - please check your connection and refresh the page');
        }
      }
    }, getTimeoutDuration());
    
    return () => {
      clearTimeout(timeoutId);
      if (unsubscribeTrucks) unsubscribeTrucks();
      if (unsubscribeMaintenance) unsubscribeMaintenance();
    };
  }, [isOnline, retryCount]); // Include isOnline and retryCount in dependencies

  // Separate effect to handle loading state updates
  useEffect(() => {
    if (trucksLoaded && maintenanceLoaded) {
      setLoading(false);
    }
  }, [trucksLoaded, maintenanceLoaded]);

  // Reset error when coming back online
  useEffect(() => {
    if (isOnline && error) {
      setError(null);
      setRetryCount(0);
    }
  }, [isOnline, error]);

  const value: TruckContextType = {
    trucks,
    maintenanceRecords,
    loading,
    error,
  };

  return (
    <TruckContext.Provider value={value}>
      {children}
    </TruckContext.Provider>
  );
};
