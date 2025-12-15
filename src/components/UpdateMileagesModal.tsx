import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Truck } from '../types';
import { updateTruck } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

interface UpdateMileagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  trucks: Truck[];
  onUpdate: () => void;
}

interface MileageUpdate {
  truckId: string;
  unitNumber: string;
  currentMileage: number;
  newMileage: number;
}

const UpdateMileagesModal: React.FC<UpdateMileagesModalProps> = ({
  isOpen,
  onClose,
  trucks,
  onUpdate
}) => {
  const { user } = useAuth();
  const [mileageUpdates, setMileageUpdates] = useState<MileageUpdate[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize mileage updates when modal opens
  useEffect(() => {
    if (isOpen && trucks.length > 0) {
      const updates = trucks
        .sort((a, b) => parseInt(a.unitNumber) - parseInt(b.unitNumber))
        .map(truck => ({
          truckId: truck.id,
          unitNumber: truck.unitNumber,
          currentMileage: truck.mileage || 0,
          newMileage: truck.mileage || 0
        }));
      setMileageUpdates(updates);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, trucks]);

  const handleMileageChange = (truckId: string, newMileage: string) => {
    const mileage = parseInt(newMileage) || 0;
    setMileageUpdates(prev => 
      prev.map(update => 
        update.truckId === truckId 
          ? { ...update, newMileage: mileage }
          : update
      )
    );
  };

  const handleSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      // Filter out trucks where mileage hasn't changed
      const trucksToUpdate = mileageUpdates.filter(
        update => update.newMileage !== update.currentMileage
      );

      if (trucksToUpdate.length === 0) {
        setError('No mileage changes detected. Please update at least one truck.');
        setIsSubmitting(false);
        return;
      }

      // Update each truck's mileage and track when it was updated
      const updatePromises = trucksToUpdate.map(update =>
        updateTruck(update.truckId, { 
          mileage: update.newMileage,
          mileageLastUpdated: new Date()
        }, user.uid)
      );

      await Promise.all(updatePromises);

      setSuccess(true);
      onUpdate(); // Refresh the parent component
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Error updating mileages:', error);
      setError('Failed to update mileages. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Update Truck Mileages</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-600 text-sm">Mileages updated successfully!</p>
            </div>
          )}

          <div className="mb-4">
            <p className="text-gray-600 text-sm">
              Update the mileage for each truck. Only trucks with changed mileages will be updated.
            </p>
          </div>

          {/* Mileage Input Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mileageUpdates.map((update) => (
              <div
                key={update.truckId}
                className={`p-4 border rounded-lg ${
                  update.newMileage !== update.currentMileage
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">
                    Unit {update.unitNumber}
                  </span>
                  {update.newMileage !== update.currentMileage && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      Changed
                    </span>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Current Mileage
                    </label>
                    <input
                      type="text"
                      value={update.currentMileage.toLocaleString()}
                      disabled
                      className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-600 text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      New Mileage
                    </label>
                    <input
                      type="number"
                      value={update.newMileage}
                      onChange={(e) => handleMileageChange(update.truckId, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 text-sm focus:ring-2 focus:ring-ems-blue focus:border-transparent"
                      placeholder="Enter new mileage"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {mileageUpdates.filter(u => u.newMileage !== u.currentMileage).length} of {mileageUpdates.length} trucks will be updated
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || mileageUpdates.filter(u => u.newMileage !== u.currentMileage).length === 0}
              className="px-4 py-2 bg-ems-blue text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Updating...' : 'Update Mileages'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateMileagesModal;

