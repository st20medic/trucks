import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot,
  CollectionReference,
  query,
  where,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';
import { Truck } from '../types';
import { photoCache } from '../utils/photoCache';

// Authentication functions
export const signIn = async (email: string, password: string) => {
  console.log('Firebase signIn called with:', email);
  console.log('Firebase auth object:', auth);
  console.log('Firebase config:', auth.app.options.projectId);
  
  // Debug: Log the actual auth instance details
  console.log('Auth app name:', auth.app.name);
  console.log('Auth app options:', auth.app.options);
  
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('Firebase authentication successful:', userCredential.user);
    return userCredential.user;
  } catch (error) {
    console.error('Firebase authentication error:', error);
    throw new Error(`Authentication failed: ${error}`);
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return firebaseOnAuthStateChanged(auth, callback);
};

// Firestore functions
export const subscribeToTrucks = (callback: (trucks: Truck[]) => void, errorCallback?: (error: Error) => void) => {
  const trucksRef = collection(db, 'trucks') as CollectionReference;
  
  // Add connection timeout and retry logic
  let retryCount = 0;
  const maxRetries = 3;
  
  const attemptSubscription = () => {
    try {
      return onSnapshot(trucksRef, (snapshot) => {
        console.log('Trucks subscription successful, received snapshot');
        const trucks = snapshot.docs.map(doc => {
          const data = doc.data();
          // Remove any custom id field from the document data to avoid conflicts
          const { id: _, ...cleanData } = data;
          
          // Helper function to safely convert dates (handles both Firestore Timestamps and strings)
          const safeDate = (value: any): Date => {
            if (!value) return new Date();
            if (value.toDate && typeof value.toDate === 'function') {
              // Firestore Timestamp object
              return value.toDate();
            }
            if (value instanceof Date) {
              return value;
            }
            // String or other format
            const date = new Date(value);
            return isNaN(date.getTime()) ? new Date() : date;
          };

          // Ensure all required fields have default values for backward compatibility
          const truckWithDefaults = {
            id: doc.id, // Use only the Firebase-generated document ID
            ...cleanData,
            vehicleType: cleanData.vehicleType || 'Not specified',
            vehicleYear: cleanData.vehicleYear || 0,
            status: cleanData.status || 'in-service',
            outOfServiceReason: cleanData.outOfServiceReason || '',
            tireSize: cleanData.tireSize || 'Not specified',
            tireConfiguration: cleanData.tireConfiguration || 'single-rear',
            equipment: cleanData.equipment || [],
            equipmentChangeHistory: cleanData.equipmentChangeHistory || [],
            photoURL: cleanData.photoURL || '',
            lastOilChange: safeDate(cleanData.lastOilChange),
            lastOilChangeMileage: cleanData.lastOilChangeMileage || 0,
            inspectionStickerExpiry: safeDate(cleanData.inspectionStickerExpiry),
            oemsInspectionExpiry: safeDate(cleanData.oemsInspectionExpiry),
            lastBrakeChange: safeDate(cleanData.lastBrakeChange),
            lastBrakeChangeMileage: cleanData.lastBrakeChangeMileage || 0,
            lastTireChange: safeDate(cleanData.lastTireChange),
            lastTireChangeMileage: cleanData.lastTireChangeMileage || 0,
            mileage: cleanData.mileage || 0,
            vin: cleanData.vin || '',
            licensePlate: cleanData.licensePlate || 'Not specified',
            unitNumber: cleanData.unitNumber || '',
            createdAt: safeDate(cleanData.createdAt),
            updatedAt: safeDate(cleanData.updatedAt),
            createdBy: cleanData.createdBy || '',
            updatedBy: cleanData.updatedBy || ''
          };
          
          return truckWithDefaults;
        });
        callback(trucks);
      }, (error) => {
        console.error('Error in trucks subscription:', error);
        
        // Handle specific Firebase errors
        if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Trucks subscription failed, retrying (${retryCount}/${maxRetries})...`);
            
            // Retry after exponential backoff
            setTimeout(() => {
              attemptSubscription();
            }, Math.pow(2, retryCount) * 1000);
            return;
          }
        }
        
        if (errorCallback) {
          errorCallback(error);
        }
      });
    } catch (error) {
      console.error('Failed to setup trucks subscription:', error);
      if (errorCallback) {
        errorCallback(error as Error);
      }
    }
  };
  
  return attemptSubscription();
};

export const subscribeToMaintenance = (callback: (records: any[]) => void, errorCallback?: (error: Error) => void) => {
  const maintenanceRef = collection(db, 'maintenance') as CollectionReference;
  
  // Add connection timeout and retry logic
  let retryCount = 0;
  const maxRetries = 3;
  
  const attemptSubscription = () => {
    try {
      return onSnapshot(maintenanceRef, (snapshot) => {
        console.log('Maintenance subscription successful, received snapshot');
        const records = snapshot.docs.map(doc => {
          const data = doc.data();
          // Remove any custom id field from the document data to avoid conflicts
          const { id: _, ...cleanData } = data;
          return {
            id: doc.id, // Use only the Firebase-generated document ID
            ...cleanData
          };
        });
        callback(records);
      }, (error) => {
        console.error('Error in maintenance subscription:', error);
        
        // Handle specific Firebase errors
        if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Maintenance subscription failed, retrying (${retryCount}/${maxRetries})...`);
            
            // Retry after exponential backoff
            setTimeout(() => {
              attemptSubscription();
            }, Math.pow(2, retryCount) * 1000);
            return;
          }
        }
        
        if (errorCallback) {
          errorCallback(error);
        }
      });
    } catch (error) {
      console.error('Failed to setup maintenance subscription:', error);
      if (errorCallback) {
        errorCallback(error as Error);
      }
    }
  };
  
  return attemptSubscription();
};

export const addMaintenanceRecord = async (record: any) => {
  try {
    console.log('Adding maintenance record:', record);
    
    const maintenanceRef = collection(db, 'maintenance');
    const recordData = {
      ...record,
      createdAt: new Date(),
      createdBy: auth.currentUser?.uid
    };
    
    console.log('Record data to be saved:', recordData);
    
    const docRef = await addDoc(maintenanceRef, recordData);
    console.log('Maintenance record saved successfully with ID:', docRef.id);
    
    // Update truck maintenance fields based on maintenance type
    if (record.truckId && record.mileage) {
      const truckRef = doc(db, 'trucks', record.truckId);
      const truckUpdates: any = {
        updatedAt: new Date(),
        updatedBy: auth.currentUser?.uid
      };
      
      // Update relevant truck fields based on maintenance type
      switch (record.type) {
        case 'oil-change':
          truckUpdates.lastOilChange = record.date;
          truckUpdates.lastOilChangeMileage = record.mileage;
          console.log('Updating truck oil change fields:', {
            lastOilChange: record.date,
            lastOilChangeMileage: record.mileage
          });
          break;
        case 'brake-change':
          truckUpdates.lastBrakeChange = record.date;
          truckUpdates.lastBrakeChangeMileage = record.mileage;
          console.log('Updating truck brake change fields:', {
            lastBrakeChange: record.date,
            lastBrakeChangeMileage: record.mileage
          });
          break;
        case 'tire-change':
          truckUpdates.lastTireChange = record.date;
          truckUpdates.lastTireChangeMileage = record.mileage;
          console.log('Updating truck tire change fields:', {
            lastTireChange: record.date,
            lastTireChangeMileage: record.mileage
          });
          break;
        case 'inspection':
          // For inspections, we might want to update inspection dates
          // but this depends on your business logic
          console.log('Inspection maintenance record added - no truck fields updated');
          break;
        default:
          console.log('Other maintenance type - no truck fields updated');
      }
      
      // Only update truck if we have specific fields to update
      if (Object.keys(truckUpdates).length > 2) { // More than just updatedAt and updatedBy
        await updateDoc(truckRef, truckUpdates);
        console.log('Truck maintenance fields updated successfully');
      }
    }
    
    return docRef;
  } catch (error) {
    console.error('Error adding maintenance record:', error);
    console.error('Record that failed to save:', record);
    throw error;
  }
};

export const updateTruckEquipment = async (truckId: string, newEquipment: any[], currentEquipment: any[] = [], userId: string) => {
  try {
    const truckRef = doc(db, 'trucks', truckId);
    
    // Track equipment changes
    const equipmentChanges = [];
    
    // Check for equipment updates and additions
    for (const newEq of newEquipment) {
      const existingEq = currentEquipment.find(eq => eq.type === newEq.type);
      
      if (existingEq) {
        // Equipment exists - check if serial number changed
        if (existingEq.serialNumber !== newEq.serialNumber) {
          equipmentChanges.push({
            id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            truckId: truckId,
            equipmentType: newEq.type,
            oldSerialNumber: existingEq.serialNumber,
            newSerialNumber: newEq.serialNumber,
            changeDate: new Date(),
            changeType: 'updated' as const,
            changedBy: userId,
            notes: `Serial number changed from ${existingEq.serialNumber} to ${newEq.serialNumber}`
          });
        }
      } else {
        // New equipment added
        equipmentChanges.push({
          id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          truckId: truckId,
          equipmentType: newEq.type,
          oldSerialNumber: undefined,
          newSerialNumber: newEq.serialNumber,
          changeDate: new Date(),
          changeType: 'added' as const,
          changedBy: userId,
          notes: `New ${newEq.type} added with serial number ${newEq.serialNumber}`
        });
      }
    }
    
    // Check for equipment removals
    for (const existingEq of currentEquipment) {
      const stillExists = newEquipment.find(eq => eq.type === existingEq.type);
      if (!stillExists) {
        equipmentChanges.push({
          id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          truckId: truckId,
          equipmentType: existingEq.type,
          oldSerialNumber: existingEq.serialNumber,
          newSerialNumber: '',
          changeDate: new Date(),
          changeType: 'removed' as const,
          changedBy: userId,
          notes: `${existingEq.type} with serial number ${existingEq.serialNumber} was removed`
        });
      }
    }
    
    // Get current truck data to update equipment change history
    const truckDoc = await getDoc(truckRef);
    const currentTruckData = truckDoc.data();
    const existingHistory = currentTruckData?.equipmentChangeHistory || [];
    
    // Update truck with new equipment and history
    await updateDoc(truckRef, {
      equipment: newEquipment,
      equipmentChangeHistory: [...existingHistory, ...equipmentChanges],
      updatedAt: new Date(),
      updatedBy: userId
    });
    
    console.log(`Equipment changes recorded: ${equipmentChanges.length} changes for truck ${truckId}`);
    
  } catch (error) {
    console.error('Error updating truck equipment:', error);
    throw error;
  }
};

// Update truck data
export const updateTruck = async (truckId: string, updates: any, userId: string, currentTruck?: any) => {
  try {
    console.log('updateTruck called with:', { truckId, updates, currentTruck });
    
    // Preserve existing photo URL if no new photo is uploaded
    let photoURL = currentTruck?.photoURL || '';
    
    // Handle photo upload if present
    if (updates.photo && updates.photo instanceof File) {
      const photoRef = ref(storage, `trucks/${Date.now()}-${updates.photo.name}`);
      const snapshot = await uploadBytes(photoRef, updates.photo);
      photoURL = await getDownloadURL(snapshot.ref);
      console.log('Photo uploaded successfully:', photoURL);
    }
    
    const truckRef = doc(db, 'trucks', truckId);
    
    // Remove the photo File object and add the photoURL before saving to Firestore
    const { photo, ...updatesForFirestore } = updates;
    
    // Remove any undefined values from the updates object
    const cleanUpdates = Object.fromEntries(
      Object.entries(updatesForFirestore).filter(([_, value]) => value !== undefined)
    );
    
    const finalUpdates = {
      ...cleanUpdates,
      photoURL,
      updatedAt: new Date(),
      updatedBy: userId
    };
    
    console.log('Saving to Firestore:', finalUpdates);
    
    await updateDoc(truckRef, finalUpdates);
    
    // Save photo URL to backup if it exists
    if (photoURL && currentTruck?.unitNumber) {
      photoCache.savePhotoURLBackup(currentTruck.unitNumber, photoURL);
    }
    
    console.log('Truck updated successfully:', truckId);
    return true;
  } catch (error) {
    console.error('Error updating truck:', error);
    throw error;
  }
};

// Add new truck to database
export const addTruck = async (truckData: any, userId: string) => {
  try {
    let photoURL = '';
    
    // Handle photo upload if present
    if (truckData.photo && truckData.photo instanceof File) {
      const photoRef = ref(storage, `trucks/${Date.now()}-${truckData.photo.name}`);
      const snapshot = await uploadBytes(photoRef, truckData.photo);
      photoURL = await getDownloadURL(snapshot.ref);
      console.log('Photo uploaded successfully:', photoURL);
    }
    
    const trucksRef = collection(db, 'trucks');
    const newTruck = {
      ...truckData,
      photoURL, // Store the photo URL instead of the File object
      status: truckData.status || 'in-service',
      outOfServiceReason: truckData.outOfServiceReason || '',
      mileageLastUpdated: new Date(), // Track when mileage was initially set
      lastOilChange: new Date(),
      lastOilChangeMileage: truckData.mileage,
      inspectionStickerExpiry: new Date(truckData.inspectionStickerExpiry),
      oemsInspectionExpiry: new Date(truckData.oemsInspectionExpiry),
      lastBrakeChange: new Date(),
      lastBrakeChangeMileage: truckData.mileage,
      lastTireChange: new Date(),
      lastTireChangeMileage: truckData.mileage,
      tireSize: truckData.tireSize || 'Not specified',
      tireConfiguration: truckData.tireConfiguration || 'single-rear',
      equipment: truckData.equipment || [], // Use provided equipment or empty array
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId
    };
    
    // Remove the photo File object before saving to Firestore
    const { photo, ...truckDataForFirestore } = newTruck;
    
    const docRef = await addDoc(trucksRef, truckDataForFirestore);
    console.log('Truck added successfully with ID:', docRef.id);
    
    // Save photo URL to backup if it exists
    if (photoURL && truckData.unitNumber) {
      photoCache.savePhotoURLBackup(truckData.unitNumber, photoURL);
    }
    
    // Return the truck data with the Firebase-generated ID
    return {
      id: docRef.id,
      ...truckDataForFirestore
    };
  } catch (error) {
    console.error('Error adding truck:', error);
    throw error;
  }
};

// Import data from JSON backup
export const importData = async (importData: any, userId: string) => {
  try {
    console.log('Starting data import:', importData);
    
    const results = {
      trucks: { imported: 0, errors: 0 },
      maintenanceRecords: { imported: 0, errors: 0 },
      errors: [] as string[]
    };

    // Import trucks
    if (importData.trucks && Array.isArray(importData.trucks)) {
      console.log(`Importing ${importData.trucks.length} trucks...`);
      
      for (const truckData of importData.trucks) {
        try {
          // Remove the id field as Firebase will generate a new one
          const { id, ...truckDataWithoutId } = truckData;
          
          // Convert date strings back to Date objects
          const processedTruckData = {
            ...truckDataWithoutId,
            lastOilChange: new Date(truckData.lastOilChange),
            lastOilChangeMileage: truckData.lastOilChangeMileage || 0,
            inspectionStickerExpiry: new Date(truckData.inspectionStickerExpiry),
            oemsInspectionExpiry: new Date(truckData.oemsInspectionExpiry),
            lastBrakeChange: new Date(truckData.lastBrakeChange),
            lastBrakeChangeMileage: truckData.lastBrakeChangeMileage || 0,
            lastTireChange: new Date(truckData.lastTireChange),
            lastTireChangeMileage: truckData.lastTireChangeMileage || 0,
            createdAt: new Date(truckData.createdAt),
            updatedAt: new Date(),
            createdBy: userId,
            updatedBy: userId
          };

          await addTruck(processedTruckData, userId);
          results.trucks.imported++;
        } catch (error) {
          console.error(`Error importing truck ${truckData.unitNumber}:`, error);
          results.trucks.errors++;
          results.errors.push(`Truck ${truckData.unitNumber}: ${error}`);
        }
      }
    }

    // Import maintenance records
    if (importData.maintenanceRecords && Array.isArray(importData.maintenanceRecords)) {
      console.log(`Importing ${importData.maintenanceRecords.length} maintenance records...`);
      
      for (const recordData of importData.maintenanceRecords) {
        try {
          // Remove the id field as Firebase will generate a new one
          const { id, ...recordDataWithoutId } = recordData;
          
          // Convert date strings back to Date objects
          const processedRecordData = {
            ...recordDataWithoutId,
            date: new Date(recordData.date),
            createdAt: new Date(),
            createdBy: userId
          };

          await addMaintenanceRecord(processedRecordData);
          results.maintenanceRecords.imported++;
        } catch (error) {
          console.error(`Error importing maintenance record:`, error);
          results.maintenanceRecords.errors++;
          results.errors.push(`Maintenance record: ${error}`);
        }
      }
    }

    console.log('Import completed:', results);
    return results;
  } catch (error) {
    console.error('Error during data import:', error);
    throw error;
  }
};

// Migrate photo URLs from old storage bucket to new one
export const migratePhotoURLs = async (oldStorageBucket: string, newStorageBucket: string, userId: string) => {
  try {
    console.log('Starting photo URL migration from', oldStorageBucket, 'to', newStorageBucket);
    
    // Get all trucks with photos from the old storage bucket
    const trucksRef = collection(db, 'trucks');
    const q = query(trucksRef, where('photoURL', '!=', ''));
    const querySnapshot = await getDocs(q);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const doc of querySnapshot.docs) {
      const truckData = doc.data();
      const photoURL = truckData.photoURL;
      
      // Check if this photo URL is from the old storage bucket
      if (photoURL && photoURL.includes(oldStorageBucket)) {
        try {
          // Extract the file path from the old URL (for future use if needed)
          // const urlParts = photoURL.split('/');
          // const filePathIndex = urlParts.findIndex((part: string) => part === 'o') + 1;
          // const encodedFilePath = urlParts[filePathIndex];
          // const filePath = decodeURIComponent(encodedFilePath);
          
          // Create new photo URL with new storage bucket
          const newPhotoURL = photoURL.replace(oldStorageBucket, newStorageBucket);
          
          // Update the truck document with the new photo URL
          await updateDoc(doc.ref, {
            photoURL: newPhotoURL,
            updatedAt: new Date(),
            updatedBy: userId
          });
          
          console.log(`Migrated photo URL for truck ${truckData.unitNumber}:`, newPhotoURL);
          migratedCount++;
          
        } catch (error) {
          console.error(`Error migrating photo for truck ${truckData.unitNumber}:`, error);
          errorCount++;
        }
      }
    }
    
    console.log(`Photo migration completed. Migrated: ${migratedCount}, Errors: ${errorCount}`);
    return { migrated: migratedCount, errors: errorCount };
    
  } catch (error) {
    console.error('Error during photo URL migration:', error);
    throw error;
  }
};

// Migrate tire configurations for existing trucks
export const migrateTireConfigurations = async () => {
  try {
    console.log('Starting tire configuration migration...');
    
    // Truck configurations based on your requirements
    const truckConfigurations = {
      '53': 'dual-rear',
      '58': 'dual-rear', 
      '61': 'dual-rear',
      '62': 'dual-rear',
      '63': 'dual-rear',
      '52': 'single-rear',
      '55': 'single-rear',
      '56': 'single-rear',
      '57': 'single-rear'
    };
    
    const trucksRef = collection(db, 'trucks');
    const snapshot = await getDocs(trucksRef);
    
    console.log(`Found ${snapshot.docs.length} trucks to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const truckDoc of snapshot.docs) {
      const truckData = truckDoc.data();
      const unitNumber = truckData.unitNumber;
      
      console.log(`Processing Unit ${unitNumber}...`);
      
      // Check if truck already has tireConfiguration set
      if (truckData.tireConfiguration) {
        console.log(`  Unit ${unitNumber} already has tireConfiguration: ${truckData.tireConfiguration}`);
        skippedCount++;
        continue;
      }
      
      // Get the configuration for this unit
      const configuration = truckConfigurations[unitNumber as keyof typeof truckConfigurations];
      
      if (!configuration) {
        console.log(`  Unit ${unitNumber} not found in configuration list, defaulting to single-rear`);
        // Update with default single-rear
        await updateDoc(doc(db, 'trucks', truckDoc.id), {
          tireConfiguration: 'single-rear',
          updatedAt: new Date(),
          updatedBy: 'migration-script'
        });
        updatedCount++;
      } else {
        console.log(`  Unit ${unitNumber} -> ${configuration}`);
        // Update with specific configuration
        await updateDoc(doc(db, 'trucks', truckDoc.id), {
          tireConfiguration: configuration,
          updatedAt: new Date(),
          updatedBy: 'migration-script'
        });
        updatedCount++;
      }
    }
    
    console.log('\nMigration completed!');
    console.log(`Updated: ${updatedCount} trucks`);
    console.log(`Skipped: ${skippedCount} trucks (already had configuration)`);
    
    return { updated: updatedCount, skipped: skippedCount };
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

// Clear maintenance alert for a specific truck and alert type
export const clearMaintenanceAlert = async (truckId: string, alertType: string, notes: string, userId?: string) => {
  try {
    console.log('Starting clearMaintenanceAlert:', { truckId, alertType, notes });
    
    const truckRef = doc(db, 'trucks', truckId);
    
    // Get current truck data to preserve existing alertsCleared
    const truckDoc = await getDoc(truckRef);
    if (!truckDoc.exists()) {
      throw new Error('Truck not found');
    }
    
    const truckData = truckDoc.data();
    console.log('Truck data retrieved:', truckData.unitNumber);
    
    const currentAlertsCleared = truckData.alertsCleared || {};
    console.log('Current alerts cleared:', currentAlertsCleared);
    
    // Update the specific alert type with current timestamp
    const updatedAlertsCleared = {
      ...currentAlertsCleared,
      [alertType]: new Date()
    };
    
    console.log('Updated alerts cleared:', updatedAlertsCleared);
    
    // Update the truck document
    await updateDoc(truckRef, {
      alertsCleared: updatedAlertsCleared,
      updatedAt: new Date(),
      updatedBy: userId || 'alert-clear-system'
    });
    
    console.log(`Alert cleared for truck ${truckId}, type: ${alertType}, notes: ${notes}`);
    
    // Create a maintenance record documenting the dismissal
    // This is critical for accountability, so we'll retry if it fails
    let maintenanceRecordCreated = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!maintenanceRecordCreated && retryCount < maxRetries) {
      try {
        await addDoc(collection(db, 'maintenance'), {
          truckId: truckId,
          truckUnitNumber: truckData.unitNumber,
          type: 'other',
          description: `Maintenance Alert Cleared: ${alertType === 'oilChange' ? 'Oil Change' : 
            alertType === 'brakeChange' ? 'Brake Service' : 
            alertType === 'tireChange' ? 'Tire Service' : 
            alertType === 'inspection' ? 'WV Inspection' : 
            alertType === 'oemsInspection' ? 'OEMS Inspection' : 
            alertType}`,
          date: new Date(),
          mileage: truckData.mileage,
          cost: 0,
          performedBy: 'Alert Clear System',
          notes: `Maintenance alert dismissed without performing work. Mechanic assessment: ${notes}`,
          createdAt: new Date(),
          createdBy: userId || 'alert-clear-system'
        });
        console.log('Maintenance record created for alert clearing');
        maintenanceRecordCreated = true;
      } catch (recordError) {
        retryCount++;
        console.warn(`Failed to create maintenance record (attempt ${retryCount}/${maxRetries}):`, recordError);
        
        if (retryCount >= maxRetries) {
          console.error('Failed to create maintenance record after all retries. This is critical for accountability.');
          // Still throw the error since this is important for accountability
          throw new Error(`Failed to create maintenance record for alert clearing: ${recordError instanceof Error ? recordError.message : String(recordError)}`);
        }
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
  } catch (error) {
    console.error('Error clearing maintenance alert:', error);
    throw error;
  }
};


