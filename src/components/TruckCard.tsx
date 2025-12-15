import React, { useState, useEffect } from 'react';
import { Truck as TruckType, MaintenanceRecord } from '../types';
import { Printer, Edit, AlertTriangle, X } from 'lucide-react';
import { photoCache } from '../utils/photoCache';
import ClearAlertModal from './ClearAlertModal';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

interface AlertInfo {
  type: 'oilChange' | 'inspection' | 'oemsInspection' | 'brakeChange' | 'tireChange';
  title: string;
  message: string;
  priority: 'overdue' | 'due-soon';
}

interface TruckCardProps {
  truck: TruckType;
  maintenanceRecords?: MaintenanceRecord[];
  onPrint?: (truckId: string) => void;
  onEdit?: () => void;
  onClearAlert?: (truckId: string, alertType: AlertInfo['type'], notes: string) => Promise<void>;
}

// Equipment display order as specified by user
const EQUIPMENT_ORDER = [
  'lifepak-15',
  'ekg-battery-charger',
  'lucas-device',
  'stretcher',
  'cot-battery-charger',
  'stairchair',
  'handheld-radio'
];

// Function to sort equipment by the specified order
const sortEquipmentByOrder = (equipment: any[]) => {
  return [...equipment].sort((a, b) => {
    const indexA = EQUIPMENT_ORDER.indexOf(a.type);
    const indexB = EQUIPMENT_ORDER.indexOf(b.type);
    
    // If both items are in the order list, sort by their position
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    
    // If only one item is in the order list, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    
    // If neither item is in the order list, maintain original order
    return 0;
  });
};

// Photo component with caching and retry logic
const TruckPhoto: React.FC<{ photoURL: string; unitNumber: string }> = ({ photoURL, unitNumber }) => {
  const [imageSrc, setImageSrc] = useState<string>(photoURL);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    if (!photoURL) {
      console.warn(`[TruckPhoto] Unit ${unitNumber}: No photoURL provided`);
      setIsLoading(false);
      setHasError(true);
      return;
    }

    // Validate URL format
    if (!photoURL.startsWith('http://') && !photoURL.startsWith('https://')) {
      console.error(`[TruckPhoto] Unit ${unitNumber}: Invalid photoURL format:`, photoURL);
      setIsLoading(false);
      setHasError(true);
      return;
    }

    // Check cache first
    const cachedPhoto = photoCache.getCachedPhoto(photoURL);
    if (cachedPhoto) {
      console.log(`[TruckPhoto] Unit ${unitNumber}: Using cached photo`);
      setImageSrc(cachedPhoto);
      setIsLoading(false);
      setHasError(false);
      setRetryCount(0);
      return;
    }

    // Not in cache, load from server
    console.log(`[TruckPhoto] Unit ${unitNumber}: Loading photo from URL:`, photoURL);
    setImageSrc(photoURL);
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0);
  }, [photoURL, unitNumber]);

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const imgElement = event.currentTarget;
    const failedUrl = imgElement.src;
    console.error(`[TruckPhoto] Unit ${unitNumber}: Image load failed`, {
      url: failedUrl,
      retryCount: retryCount + 1,
      maxRetries,
      photoURL: photoURL
    });
    
    // Clear bad cached URL if it exists
    if (photoCache.isCached(photoURL)) {
      console.warn(`[TruckPhoto] Unit ${unitNumber}: Clearing bad cached URL`);
      photoCache.removeCachedPhoto(photoURL);
    }
    
    if (retryCount < maxRetries) {
      // Retry with a slight delay and cache-busting parameter
      const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      console.log(`[TruckPhoto] Unit ${unitNumber}: Retrying in ${retryDelay}ms (attempt ${retryCount + 2}/${maxRetries + 1})`);
      setTimeout(() => {
        const cacheBuster = `?retry=${Date.now()}`;
        setImageSrc(photoURL + cacheBuster);
        setRetryCount(prev => prev + 1);
      }, retryDelay);
    } else {
      // Max retries reached, show error state
      console.error(`[TruckPhoto] Unit ${unitNumber}: All retries exhausted. Photo unavailable. URL:`, photoURL);
      setHasError(true);
      setIsLoading(false);
    }
  };

  const handleImageLoad = () => {
    console.log(`[TruckPhoto] Unit ${unitNumber}: Image loaded successfully`);
    setIsLoading(false);
    setHasError(false);
    // Cache the successfully loaded photo
    photoCache.setCachedPhoto(photoURL, imageSrc);
  };

  if (hasError) {
    return (
      <div className="mb-3">
        <div className="w-full h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
          <span className="text-xs text-gray-500">Photo unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3">
      {isLoading && (
        <div className="w-full h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ems-blue"></div>
        </div>
      )}
      <img 
        src={imageSrc} 
        alt={`Unit ${unitNumber}`}
        className={`w-full h-24 object-cover rounded-lg border border-gray-200 ${isLoading ? 'hidden' : 'block'}`}
        onError={handleImageError}
        onLoad={handleImageLoad}
        loading="lazy"
      />
    </div>
  );
};

const TruckCard: React.FC<TruckCardProps> = ({ truck, maintenanceRecords = [], onPrint, onEdit, onClearAlert }) => {
  const { user } = useAuth();
  const [showClearAlertModal, setShowClearAlertModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertInfo | null>(null);
  const [restoredPhotoURL, setRestoredPhotoURL] = useState<string | null>(null);
  
  const isOutOfService = truck.status === 'out-of-service';
  const needsMaintenance = truck.mileage > truck.lastOilChangeMileage + 5000;

  // Check for missing photoURL and restore from backup if available
  useEffect(() => {
    if (!truck.photoURL && truck.id && truck.unitNumber && user) {
      // Check if we have a backup
      const backupURL = photoCache.getPhotoURLBackup(truck.unitNumber);
      
      if (backupURL) {
        console.log(`[TruckCard] Unit ${truck.unitNumber}: PhotoURL missing in Firestore, found backup. Restoring...`);
        setRestoredPhotoURL(backupURL);
        
        // Restore to Firestore in the background
        const restorePhotoURL = async () => {
          try {
            const truckRef = doc(db, 'trucks', truck.id);
            await updateDoc(truckRef, {
              photoURL: backupURL,
              updatedAt: new Date(),
              updatedBy: user.uid
            });
            console.log(`[TruckCard] Unit ${truck.unitNumber}: PhotoURL restored to Firestore successfully`);
          } catch (error) {
            console.error(`[TruckCard] Unit ${truck.unitNumber}: Failed to restore photoURL to Firestore:`, error);
          }
        };
        
        restorePhotoURL();
      } else {
        console.warn(`[TruckCard] Unit ${truck.unitNumber}: No photoURL in database and no backup found.`);
      }
    } else if (truck.photoURL) {
      // If photoURL exists, clear any restored URL
      setRestoredPhotoURL(null);
    }
  }, [truck.photoURL, truck.id, truck.unitNumber, user]);
  
  const formatMileage = (mileage: number) => {
    return mileage.toLocaleString();
  };

  // Helper function to safely format dates (handles Firestore Timestamps)
  const formatDate = (date: any): string => {
    try {
      if (!date) return 'Not available';
      
      // Check if it's a Firestore Timestamp (has toDate method)
      if (typeof date === 'object' && date !== null && 'toDate' in date && typeof date.toDate === 'function') {
        return date.toDate().toLocaleDateString();
      }
      
      // If it's already a Date object or date string
      const dateObj = date instanceof Date ? date : new Date(date);
      
      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
      }
      
      return dateObj.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting date:', error, 'Date value:', date);
      return 'Invalid Date';
    }
  };

  // Helper function to get expiration color based on days until expiry
  const getExpirationColor = (expiryDate: Date) => {
    const today = new Date();
    const timeDiff = expiryDate.getTime() - today.getTime();
    const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (daysUntilExpiry <= 10) {
      return 'text-red-600 font-medium'; // Red for 10 days or less
    } else if (daysUntilExpiry <= 30) {
      return 'text-orange-600 font-medium'; // Orange for 30 days or less
    }
    return 'font-medium'; // Default color for more than 30 days
  };

  // Calculate total repair costs for this truck
  const totalRepairCosts = maintenanceRecords
    .filter(record => record.truckId === truck.id)
    .reduce((total, record) => total + (record.cost || 0), 0);

  // Check for maintenance alerts
  const getMaintenanceAlerts = (): AlertInfo[] => {
    const alerts: AlertInfo[] = [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Helper to check if alert was cleared recently
    const isAlertClearedRecently = (alertType: keyof NonNullable<TruckType['alertsCleared']>) => {
      const clearedDate = truck.alertsCleared?.[alertType];
      if (!clearedDate) return false;
      
      let cleared: Date;
      if (clearedDate && typeof clearedDate === 'object' && 'toDate' in clearedDate && typeof (clearedDate as any).toDate === 'function') {
        // Firestore Timestamp
        cleared = (clearedDate as any).toDate();
      } else {
        // JavaScript Date or date string
        cleared = clearedDate instanceof Date ? clearedDate : new Date(clearedDate);
      }
      
      return cleared > sevenDaysAgo;
    };

    // Oil Change Check (every 5000 miles)
    const nextOilChangeMileage = (truck.lastOilChangeMileage || 0) + 5000;
    if (truck.mileage >= nextOilChangeMileage && !isAlertClearedRecently('oilChange')) {
      const milesOverdue = truck.mileage - nextOilChangeMileage;
      alerts.push({
        type: 'oilChange',
        title: '🛢️ Oil Change',
        message: `Overdue by ${milesOverdue} miles. Last changed at ${truck.lastOilChangeMileage.toLocaleString()} on ${formatDate(truck.lastOilChange)}. Next due at ${nextOilChangeMileage.toLocaleString()} miles.`,
        priority: 'overdue'
      });
    } else if (truck.mileage >= nextOilChangeMileage - 500 && !isAlertClearedRecently('oilChange')) {
      alerts.push({
        type: 'oilChange',
        title: '🛢️ Oil Change',
        message: `Due in ${nextOilChangeMileage - truck.mileage} miles. Last changed at ${truck.lastOilChangeMileage.toLocaleString()} on ${formatDate(truck.lastOilChange)}. Next due at ${nextOilChangeMileage.toLocaleString()} miles.`,
        priority: 'due-soon'
      });
    }

    // WV Inspection Check (30 days warning)
    if (truck.inspectionStickerExpiry && !isAlertClearedRecently('inspection')) {
      const inspectionDate = truck.inspectionStickerExpiry instanceof Date ? truck.inspectionStickerExpiry : new Date(truck.inspectionStickerExpiry);
      const daysUntilExpiry = Math.ceil((inspectionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 0) {
        alerts.push({
          type: 'inspection',
          title: '📋 WV Inspection',
          message: `Expired on ${formatDate(truck.inspectionStickerExpiry)}.`,
          priority: 'overdue'
        });
      } else if (daysUntilExpiry <= 30) {
        alerts.push({
          type: 'inspection',
          title: '📋 WV Inspection',
          message: `Expires in ${daysUntilExpiry} days on ${formatDate(truck.inspectionStickerExpiry)}.`,
          priority: 'due-soon'
        });
      }
    }

    // OEMS Inspection Check (30 days warning)
    if (truck.oemsInspectionExpiry && !isAlertClearedRecently('oemsInspection')) {
      const oemsDate = truck.oemsInspectionExpiry instanceof Date ? truck.oemsInspectionExpiry : new Date(truck.oemsInspectionExpiry);
      const daysUntilOemsExpiry = Math.ceil((oemsDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilOemsExpiry <= 0) {
        alerts.push({
          type: 'oemsInspection',
          title: '🏥 OEMS Inspection',
          message: `Expired on ${formatDate(truck.oemsInspectionExpiry)}.`,
          priority: 'overdue'
        });
      } else if (daysUntilOemsExpiry <= 30) {
        alerts.push({
          type: 'oemsInspection',
          title: '🏥 OEMS Inspection',
          message: `Expires in ${daysUntilOemsExpiry} days on ${formatDate(truck.oemsInspectionExpiry)}.`,
          priority: 'due-soon'
        });
      }
    }

    // Brake Change Check (every 25000 miles)
    const nextBrakeChangeMileage = (truck.lastBrakeChangeMileage || 0) + 25000;
    if (truck.mileage >= nextBrakeChangeMileage && !isAlertClearedRecently('brakeChange')) {
      const milesOverdue = truck.mileage - nextBrakeChangeMileage;
      alerts.push({
        type: 'brakeChange',
        title: '🛑 Brake Service',
        message: `Overdue by ${milesOverdue} miles. Last changed at ${truck.lastBrakeChangeMileage.toLocaleString()} on ${formatDate(truck.lastBrakeChange)}. Next due at ${nextBrakeChangeMileage.toLocaleString()} miles.`,
        priority: 'overdue'
      });
    } else if (truck.mileage >= nextBrakeChangeMileage - 2500 && !isAlertClearedRecently('brakeChange')) {
      alerts.push({
        type: 'brakeChange',
        title: '🛑 Brake Service',
        message: `Due in ${nextBrakeChangeMileage - truck.mileage} miles. Last changed at ${truck.lastBrakeChangeMileage.toLocaleString()} on ${formatDate(truck.lastBrakeChange)}. Next due at ${nextBrakeChangeMileage.toLocaleString()} miles.`,
        priority: 'due-soon'
      });
    }

    // Tire Change Check (every 40000 miles)
    const nextTireChangeMileage = (truck.lastTireChangeMileage || 0) + 40000;
    if (truck.mileage >= nextTireChangeMileage && !isAlertClearedRecently('tireChange')) {
      const milesOverdue = truck.mileage - nextTireChangeMileage;
      alerts.push({
        type: 'tireChange',
        title: '🛞 Tire Service',
        message: `Overdue by ${milesOverdue} miles. Last changed at ${truck.lastTireChangeMileage.toLocaleString()} on ${formatDate(truck.lastTireChange)}. Next due at ${nextTireChangeMileage.toLocaleString()} miles.`,
        priority: 'overdue'
      });
    } else if (truck.mileage >= nextTireChangeMileage - 4000 && !isAlertClearedRecently('tireChange')) {
      alerts.push({
        type: 'tireChange',
        title: '🛞 Tire Service',
        message: `Due in ${nextTireChangeMileage - truck.mileage} miles. Last changed at ${truck.lastTireChangeMileage.toLocaleString()} on ${formatDate(truck.lastTireChange)}. Next due at ${nextTireChangeMileage.toLocaleString()} miles.`,
        priority: 'due-soon'
      });
    }

    return alerts;
  };

  const maintenanceAlerts = getMaintenanceAlerts();

  const handleClearAlert = (alert: AlertInfo) => {
    setSelectedAlert(alert);
    setShowClearAlertModal(true);
  };

  const handleClearAlertConfirm = async (truckId: string, alertType: AlertInfo['type'], notes: string) => {
    if (onClearAlert) {
      await onClearAlert(truckId, alertType, notes);
    }
  };

  return (
    <div className={`truck-card ${isOutOfService ? 'border-ems-red' : 'border-ems-blue'} flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            isOutOfService ? 'bg-ems-red' : 'bg-ems-green'
          }`} />
          <h3 className="text-lg font-bold text-gray-900">
            Unit {truck.unitNumber}
          </h3>
        </div>
        
        <div className="text-sm text-gray-600">
          <span className="font-medium">Repair Costs:</span> ${totalRepairCosts.toLocaleString()}
        </div>
      </div>

      {/* Photo */}
      {(truck.photoURL || restoredPhotoURL) ? (
        <TruckPhoto photoURL={truck.photoURL || restoredPhotoURL || ''} unitNumber={truck.unitNumber} />
      ) : (
        // Show placeholder for trucks without photos
        <div className="mb-3">
          <div className="w-full h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
            <span className="text-xs text-gray-500">No photo available</span>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <span className={`status-badge ${
            isOutOfService ? 'status-out-service' : 'status-in-service'
          }`}>
            {isOutOfService ? 'Out of Service' : 'In Service'}
          </span>
          
          {needsMaintenance && (
            <div className="flex items-center text-ems-yellow">
              <AlertTriangle className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Maintenance Due</span>
            </div>
          )}
        </div>
        
        {truck.outOfServiceReason && (
          <p className="text-sm text-gray-600 mt-1">{truck.outOfServiceReason}</p>
        )}
      </div>

      {/* Maintenance Alerts */}
      {maintenanceAlerts.length > 0 && (
        <div className="mb-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-red-800 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Maintenance Alerts
              </h4>
              <span className="text-xs text-red-600 font-medium">
                {maintenanceAlerts.length} alert{maintenanceAlerts.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2">
              {maintenanceAlerts.map((alert, index) => (
                <div key={index} className="bg-white border border-red-200 rounded p-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        alert.priority === 'overdue' ? 'text-red-700' : 'text-yellow-700'
                      }`}>
                        {alert.title}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">{alert.message}</p>
                    </div>
                    {onClearAlert && (
                      <button
                        onClick={() => handleClearAlert(alert)}
                        className="ml-2 text-red-600 hover:text-red-800 transition-colors"
                        title="Clear this alert"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="space-y-2 text-sm text-gray-600 mb-4 flex-grow">
        <div className="flex justify-between">
          <span>VIN:</span>
          <span className="font-mono text-xs">{truck.vin}</span>
        </div>
        <div className="flex justify-between">
          <span>Vehicle:</span>
          <span className="font-medium">{truck.vehicleType || 'Not specified'}</span>
        </div>
        <div className="flex justify-between">
          <span>Year:</span>
          <span className="font-medium">{truck.vehicleYear || 'Not specified'}</span>
        </div>
        <div className="flex justify-between">
          <span>License Plate:</span>
          <span className="font-medium">{truck.licensePlate || 'Not specified'}</span>
        </div>
        <div className="flex justify-between">
          <span>Mileage:</span>
          <span className="font-medium">{formatMileage(truck.mileage)}</span>
        </div>
        <div className="flex justify-between">
          <span>Mileage Last Updated:</span>
          <span className="text-xs text-gray-500">
            {formatDate(truck.mileageLastUpdated || truck.updatedAt)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>WV Inspection:</span>
          <span className={getExpirationColor(new Date(truck.inspectionStickerExpiry))}>
            {new Date(truck.inspectionStickerExpiry).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span>OEMS Inspection:</span>
          <span className={getExpirationColor(new Date(truck.oemsInspectionExpiry))}>
            {new Date(truck.oemsInspectionExpiry).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Tire Size:</span>
          <span className="font-medium">{truck.tireSize || 'Not specified'}</span>
        </div>
        <div className="flex justify-between">
          <span>Last Oil Change:</span>
          <span>{formatMileage(truck.lastOilChangeMileage)}</span>
        </div>
        <div className="flex justify-between">
          <span>Oil Change Due:</span>
          <span className={needsMaintenance ? 'text-ems-yellow font-medium' : ''}>
            {formatMileage(truck.lastOilChangeMileage + 5000)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Last Brake Change:</span>
          <span>{formatMileage(truck.lastBrakeChangeMileage)}</span>
        </div>

        {/* Equipment Count */}
        <div className="mt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Equipment:</span>
            <span className="text-sm font-medium">
              {truck.equipment?.length || 0} items
            </span>
          </div>
          {truck.equipment && truck.equipment.length > 0 && (
            <div className="mt-2 space-y-1">
              {sortEquipmentByOrder(truck.equipment).map((item) => (
                <div key={item.id} className="text-xs text-gray-500 flex justify-between">
                  <span className="capitalize">{item.type.replace('-', ' ')}</span>
                  <span className="font-mono">{item.serialNumber}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions - Fixed at bottom */}
      <div className="flex space-x-2 mt-auto">
        {onPrint && (
          <button
            onClick={() => onPrint(truck.id)}
            className="btn-secondary flex-1 flex items-center justify-center text-sm"
            title="Print truck details"
          >
            <Printer className="h-4 w-4 mr-1" />
            Print
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            className="btn-secondary flex-1 flex items-center justify-center text-sm"
            title="Edit truck"
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </button>
        )}
      </div>

      {/* Clear Alert Modal */}
      {selectedAlert && (
        <ClearAlertModal
          isOpen={showClearAlertModal}
          onClose={() => {
            setShowClearAlertModal(false);
            setSelectedAlert(null);
          }}
          truck={truck}
          alert={selectedAlert}
          onClearAlert={handleClearAlertConfirm}
        />
      )}
    </div>
  );
};

export default TruckCard;
