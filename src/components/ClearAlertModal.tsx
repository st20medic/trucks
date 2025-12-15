import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import { Truck } from '../types';

interface AlertInfo {
  type: 'oilChange' | 'inspection' | 'oemsInspection' | 'brakeChange' | 'tireChange';
  title: string;
  message: string;
  priority: 'overdue' | 'due-soon';
}

interface ClearAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  truck: Truck;
  alert: AlertInfo;
  onClearAlert: (truckId: string, alertType: AlertInfo['type'], notes: string) => Promise<void>;
}

const ClearAlertModal: React.FC<ClearAlertModalProps> = ({
  isOpen,
  onClose,
  truck,
  alert,
  onClearAlert
}) => {
  const [notes, setNotes] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  const handleClearAlert = async () => {
    if (!notes.trim()) {
      window.alert('Please provide notes explaining why this alert is being cleared.');
      return;
    }

    setIsClearing(true);
    try {
      await onClearAlert(truck.id, alert.type, notes.trim());
      onClose();
      setNotes('');
    } catch (error) {
      console.error('Error clearing alert:', error);
      window.alert('Failed to clear alert. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  const getAlertIcon = () => {
    switch (alert.type) {
      case 'oilChange':
        return '🛢️';
      case 'inspection':
        return '📋';
      case 'oemsInspection':
        return '🏥';
      case 'brakeChange':
        return '🛑';
      case 'tireChange':
        return '🛞';
      default:
        return '⚠️';
    }
  };

  const getAlertColor = () => {
    return alert.priority === 'overdue' ? 'text-red-600' : 'text-yellow-600';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Clear Maintenance Alert</h2>
              <p className="text-sm text-gray-500">Unit {truck.unitNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Alert Details */}
        <div className="p-6">
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-3">
              <span className="text-2xl">{getAlertIcon()}</span>
              <div className="flex-1">
                <h3 className={`font-semibold ${getAlertColor()}`}>
                  {alert.title}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {alert.message}
                </p>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    alert.priority === 'overdue' 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {alert.priority === 'overdue' ? 'Overdue' : 'Due Soon'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Input */}
          <div className="mb-6">
            <label htmlFor="clear-notes" className="block text-sm font-medium text-gray-700 mb-2">
              Mechanic Assessment *
            </label>
            <textarea
              id="clear-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Mechanic inspected brakes and found adequate pad thickness (8mm remaining). No immediate action needed. Will monitor and replace when pads reach minimum thickness (3mm)..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              <strong>This assessment will be recorded in the maintenance history for accountability.</strong> Please provide detailed inspection findings and reasoning for dismissing this alert.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAlert}
              disabled={isClearing || !notes.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors flex items-center justify-center"
            >
              {isClearing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Clearing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Clear Alert
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClearAlertModal;
