import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Truck, Wrench, Activity } from 'lucide-react';
import { useTrucks } from '../contexts/TruckContext';
import { addMaintenanceRecord, updateTruckEquipment } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Equipment } from '../types';
// import { logMaintenanceAction, logEquipmentAction } from '../services/auditLogger';

const maintenanceSchema = z.object({
  truckId: z.string().min(1, 'Please select a truck'),
  type: z.enum(['oil-change', 'inspection', 'brake-change', 'tire-change', 'other']),
  description: z.string().min(1, 'Description is required'),
  date: z.string().min(1, 'Date is required'),
  mileage: z.number().min(0, 'Mileage must be positive'),
  cost: z.number().min(0, 'Cost must be positive'),
  performedBy: z.string().min(1, 'Performer is required'),
  notes: z.string().optional(),
  // Status change fields
  changeStatus: z.boolean().optional(),
  newStatus: z.enum(['in-service', 'out-of-service']).optional(),
  outOfServiceReason: z.string().optional(),
  // Note: tiresChanged is NOT included in the schema as it's managed separately
});

type MaintenanceFormData = z.infer<typeof maintenanceSchema>;

const equipmentSchema = z.object({
  type: z.enum(['stretcher', 'lucas-device', 'lifepak-15', 'stairchair', 'handheld-radio', 'ekg-battery-charger', 'cot-battery-charger']),
  serialNumber: z.string().min(1, 'Serial number is required'),
  notes: z.string().optional(),
});

type EquipmentFormData = z.infer<typeof equipmentSchema>;

const statusSchema = z.object({
  status: z.enum(['in-service', 'out-of-service']),
  outOfServiceReason: z.string().optional(),
});

type StatusFormData = z.infer<typeof statusSchema>;

const MaintenanceForm: React.FC = () => {
  const { trucks } = useTrucks();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'maintenance' | 'equipment' | 'status'>('maintenance');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedTires, setSelectedTires] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
  } = useForm<MaintenanceFormData>({
    resolver: zodResolver(maintenanceSchema),
  });

  const {
    register: registerEquipment,
    handleSubmit: handleSubmitEquipment,
    reset: resetEquipment,
    formState: { errors: equipmentErrors },
  } = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
  });

  const {
    register: registerStatus,
    handleSubmit: handleSubmitStatus,
    reset: resetStatus,
    formState: { errors: statusErrors },
  } = useForm<StatusFormData>({
    resolver: zodResolver(statusSchema),
  });

  const selectedTruckId = watch('truckId');
  const selectedTruck = trucks.find(t => t.id === selectedTruckId);
  const maintenanceType = watch('type');



  // Get tire positions based on truck configuration
  const getTirePositions = (truck: any) => {
    if (!truck) return [];
    

    
    // Handle trucks without tireConfiguration field (backward compatibility)
    const tireConfig = truck.tireConfiguration || 'single-rear';
    
    if (tireConfig === 'dual-rear') {
      return ['FL', 'FR', 'RLI', 'RLO', 'RRI', 'RRO'];
    } else {
      return ['FL', 'FR', 'RL', 'RR'];
    }
  };

  // Handle tire selection
  const handleTireSelection = (tirePosition: string) => {
    setSelectedTires(prev => 
      prev.includes(tirePosition) 
        ? prev.filter(t => t !== tirePosition)
        : [...prev, tirePosition]
    );
  };

  // Reset tire selection when truck or maintenance type changes
  React.useEffect(() => {
    setSelectedTires([]);
  }, [selectedTruckId, maintenanceType]);

  const onSubmitMaintenance = async (data: MaintenanceFormData) => {
    if (!user) return;
    
    setLoading(true);
    setSuccessMessage(null);

    try {
      console.log('=== DEBUGGING MAINTENANCE FORM SUBMISSION ===');
      console.log('Form data received:', data);
      console.log('Form data keys:', Object.keys(data));
      
      // Explicitly remove any undefined fields from the data
      const cleanFormData = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined)
      );
      
      console.log('Clean form data:', cleanFormData);
      console.log('Clean form data keys:', Object.keys(cleanFormData));
      
      // Parse date as Eastern Time (avoid timezone issues)
      // HTML date input provides YYYY-MM-DD format
      // We need to create the date at noon local time to avoid timezone shifts
      const [year, month, day] = data.date.split('-').map(Number);
      const dateInEasternTime = new Date(year, month - 1, day, 12, 0, 0); // Month is 0-indexed, set to noon
      
      // Prepare maintenance record data
      const maintenanceData: any = {
        ...cleanFormData,
        truckUnitNumber: selectedTruck?.unitNumber || '',
        date: dateInEasternTime,
        mileage: data.mileage,
        cost: data.cost,
        performedBy: data.performedBy,
        notes: data.notes,
        createdBy: user.uid,
      };

      console.log('Maintenance data before tire check:', maintenanceData);
      console.log('Maintenance data keys before tire check:', Object.keys(maintenanceData));

      // Only include tiresChanged if it's a tire change and has values
      if (data.type === 'tire-change' && selectedTires.length > 0) {
        maintenanceData.tiresChanged = selectedTires;
        console.log('Added tiresChanged:', selectedTires);
      } else {
        console.log('NOT adding tiresChanged - type:', data.type, 'selectedTires:', selectedTires);
      }

      console.log('Final maintenance data:', maintenanceData);
      console.log('Final maintenance data keys:', Object.keys(maintenanceData));
      console.log('=== END DEBUGGING ===');

      // Add maintenance record
      console.log('Sending maintenance data to Firebase:', maintenanceData);
      console.log('Form data (original):', data);
      console.log('Selected tires:', selectedTires);
      console.log('Maintenance type:', data.type);
      
      const result = await addMaintenanceRecord(maintenanceData);
      console.log('Maintenance record saved successfully:', result);

      // Handle status change if requested
      if (data.changeStatus && data.newStatus && selectedTruck) {
        try {
          const truckRef = doc(db, 'trucks', selectedTruck.id);
          const statusUpdate: any = {
            status: data.newStatus,
            updatedAt: new Date(),
            updatedBy: user.uid
          };

          // Only include outOfServiceReason if status is out-of-service
          if (data.newStatus === 'out-of-service') {
            statusUpdate.outOfServiceReason = data.outOfServiceReason || '';
          } else {
            // Clear out of service reason if putting back in service
            statusUpdate.outOfServiceReason = '';
          }

          await updateDoc(truckRef, statusUpdate);
          console.log('Truck status updated successfully:', data.newStatus);
        } catch (statusError) {
          console.error('Error updating truck status:', statusError);
          // Don't fail the entire operation if status update fails
        }
      }

      // Log the action (temporarily disabled for debugging)
      // await logMaintenanceAction('create', maintenanceRecord.id, user.uid, user.email || 'Unknown', {
      //   truckId: data.truckId,
      //   truckUnitNumber: selectedTruck?.unitNumber || '',
      //   type: data.type,
      //   description: data.description,
      //   date: data.date,
      //   mileage: data.mileage,
      //   cost: data.cost,
      //   performedBy: data.performedBy,
      //   notes: data.notes
      // });

      const successMsg = data.changeStatus && data.newStatus 
        ? `Maintenance record added and truck status updated to ${data.newStatus === 'in-service' ? 'In Service' : 'Out of Service'}!`
        : 'Maintenance record added successfully!';
      
      setSuccessMessage(successMsg);
      reset();
      setSelectedTires([]);
    } catch (error) {
      console.error('Error adding maintenance record:', error);
      console.error('Error details:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Error adding maintenance record. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('invalid-argument')) {
          errorMessage = 'Error: Invalid data format. Please check all fields and try again.';
        } else if (error.message.includes('permission-denied')) {
          errorMessage = 'Error: Permission denied. Please make sure you are logged in.';
        } else if (error.message.includes('unavailable')) {
          errorMessage = 'Error: Service temporarily unavailable. Please try again.';
        }
      }
      
      setSuccessMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onSubmitEquipment = async (data: EquipmentFormData) => {
    if (!user || !selectedTruck) return;
    
    setLoading(true);
    setSuccessMessage(null);

    try {
      // Create new equipment item
      const newEquipment: Equipment = {
        id: `equipment-${Date.now()}`,
        type: data.type,
        serialNumber: data.serialNumber,
        assignedDate: new Date(),
        notes: data.notes,
      };

      // Update truck equipment - replace existing equipment of the same type
      const existingEquipment = selectedTruck.equipment || [];
      const filteredEquipment = existingEquipment.filter(eq => eq.type !== data.type);
      const updatedEquipment = [...filteredEquipment, newEquipment];
      await updateTruckEquipment(selectedTruck.id, updatedEquipment, existingEquipment, user.uid);

      // Log the action (temporarily disabled for debugging)
      // await logEquipmentAction('update', selectedTruck.id, user.uid, user.email || 'Unknown', {
      //   truckId: selectedTruck.id,
      //   truckUnitNumber: selectedTruck.unitNumber,
      //   equipmentType: data.type,
      //   serialNumber: data.serialNumber,
      //   action: 'replaced existing equipment',
      //   notes: data.notes
      // });

      setSuccessMessage('Equipment updated successfully!');
      resetEquipment();
    } catch (error) {
      console.error('Error adding equipment:', error);
      setSuccessMessage('Error adding equipment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const removeEquipment = async (equipmentId: string) => {
    if (!selectedTruck || !user) return;
    
    try {
      // const equipmentToRemove = selectedTruck.equipment?.find(eq => eq.id === equipmentId);
      const currentEquipment = selectedTruck.equipment || [];
      const updatedEquipment = currentEquipment.filter(eq => eq.id !== equipmentId);
      await updateTruckEquipment(selectedTruck.id, updatedEquipment, currentEquipment, user.uid);

      // Log the action (temporarily disabled for debugging)
      // if (equipmentToRemove) {
      //   await logEquipmentAction('delete', selectedTruck.id, user.uid, user.email || 'Unknown', {
      //   truckId: selectedTruck.id,
      //   truckUnitNumber: selectedTruck.unitNumber,
      //   equipmentType: equipmentToRemove.type,
      //   serialNumber: equipmentToRemove.serialNumber,
      //   action: 'removed equipment',
      //   notes: equipmentToRemove.notes
      //   });
      // }

      setSuccessMessage('Equipment removed successfully!');
    } catch (error) {
      console.error('Error removing equipment:', error);
      setSuccessMessage('Error removing equipment. Please try again.');
    }
  };

  const onSubmitStatus = async (data: StatusFormData) => {
    if (!user || !selectedTruck) return;
    
    setLoading(true);
    setSuccessMessage(null);

    try {
      // Update truck status in Firebase
      const truckRef = doc(db, 'trucks', selectedTruck.id);
      await updateDoc(truckRef, {
        status: data.status,
        outOfServiceReason: data.status === 'out-of-service' ? data.outOfServiceReason || '' : '',
        updatedAt: new Date(),
        updatedBy: user.uid
      });

      setSuccessMessage('Truck status updated successfully!');
      resetStatus();
    } catch (error) {
      console.error('Error updating truck status:', error);
      setSuccessMessage('Error updating truck status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Maintenance & Equipment Management</h2>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className={`mb-4 p-3 rounded-md ${
          successMessage.includes('Error') 
            ? 'bg-red-50 text-red-700 border border-red-200' 
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {successMessage}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'maintenance'
              ? 'bg-white text-ems-blue shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Truck className="h-4 w-4 inline mr-2" />
          Maintenance Records
        </button>
        <button
          onClick={() => setActiveTab('equipment')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'equipment'
              ? 'bg-white text-ems-blue shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Wrench className="h-4 w-4 inline mr-2" />
          Equipment Management
        </button>
        <button
          onClick={() => setActiveTab('status')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'status'
              ? 'bg-white text-ems-blue shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Activity className="h-4 w-4 inline mr-2" />
          Status
        </button>
      </div>

      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && (
        <form onSubmit={handleSubmit(onSubmitMaintenance)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Truck Selection */}
            <div>
              <label htmlFor="truckId" className="block text-sm font-medium text-gray-700 mb-2">
                Select Truck
              </label>
              <select
                {...register('truckId')}
                id="truckId"
                className="input-field w-full"
              >
                <option value="">Choose a truck...</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>
                    Unit {truck.unitNumber} - {truck.status}
                  </option>
                ))}
              </select>
              {errors.truckId && (
                <p className="mt-1 text-sm text-red-600">{errors.truckId.message}</p>
              )}
            </div>

            {/* Maintenance Type */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                Maintenance Type
              </label>
              <select
                {...register('type')}
                id="type"
                className="input-field w-full"
              >
                <option value="">Select type...</option>
                <option value="oil-change">Oil Change</option>
                <option value="inspection">Inspection</option>
                <option value="brake-change">Brake Change</option>
                <option value="tire-change">Tire Change</option>
                <option value="other">Other</option>
              </select>
              {errors.type && (
                <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
              )}
            </div>
          </div>



          {/* Tire Selection - Only show when Tire Change is selected and truck is selected */}
          {maintenanceType === 'tire-change' && selectedTruck && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Select Tires Changed - Unit {selectedTruck.unitNumber}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Check the tires that were changed during this maintenance:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {getTirePositions(selectedTruck).map((tirePosition) => (
                  <label
                    key={tirePosition}
                    className="flex items-center space-x-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTires.includes(tirePosition)}
                      onChange={() => handleTireSelection(tirePosition)}
                      className="h-4 w-4 text-ems-blue focus:ring-ems-blue border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {tirePosition}
                    </span>
                  </label>
                ))}
              </div>
              {selectedTires.length > 0 && (
                <p className="mt-3 text-sm text-gray-600">
                  Selected: {selectedTires.join(', ')}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                {...register('date')}
                type="date"
                id="date"
                className="input-field w-full"
              />
              {errors.date && (
                <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
              )}
            </div>

            {/* Mileage */}
            <div>
              <label htmlFor="mileage" className="block text-sm font-medium text-gray-700 mb-2">
                Mileage
              </label>
              <input
                {...register('mileage', { valueAsNumber: true })}
                type="number"
                id="mileage"
                className="input-field w-full"
                placeholder="Current mileage"
              />
              {errors.mileage && (
                <p className="mt-1 text-sm text-red-600">{errors.mileage.message}</p>
              )}
            </div>

            {/* Cost */}
            <div>
              <label htmlFor="cost" className="block text-sm font-medium text-gray-700 mb-2">
                Cost ($)
              </label>
              <input
                {...register('cost', { valueAsNumber: true })}
                type="number"
                step="0.01"
                id="cost"
                className="input-field w-full"
                placeholder="0.00"
              />
              {errors.cost && (
                <p className="mt-1 text-sm text-red-600">{errors.cost.message}</p>
              )}
            </div>

            {/* Performed By */}
            <div>
              <label htmlFor="performedBy" className="block text-sm font-medium text-gray-700 mb-2">
                Performed By
              </label>
              <input
                {...register('performedBy')}
                type="text"
                id="performedBy"
                className="input-field w-full"
                placeholder="Technician name"
              />
              {errors.performedBy && (
                <p className="mt-1 text-sm text-red-600">{errors.performedBy.message}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              {...register('description')}
              id="description"
              rows={3}
              className="input-field w-full"
              placeholder="Describe the maintenance performed..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              {...register('notes')}
              id="notes"
              rows={2}
              className="input-field w-full"
              placeholder="Additional notes..."
            />
          </div>

          {/* Status Change Section */}
          {selectedTruck && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Change Truck Status (Optional)
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                You can change the truck's status while entering this maintenance record:
              </p>
              
              <div className="space-y-4">
                {/* Current Status Display */}
                <div className="bg-white p-3 rounded border">
                  <p className="text-sm font-medium text-gray-700">Current Status:</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                    selectedTruck.status === 'in-service' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedTruck.status === 'in-service' ? 'In Service' : 'Out of Service'}
                  </span>
                  {selectedTruck.status === 'out-of-service' && selectedTruck.outOfServiceReason && (
                    <p className="text-sm text-gray-600 mt-1">
                      Reason: {selectedTruck.outOfServiceReason}
                    </p>
                  )}
                </div>

                {/* Change Status Checkbox */}
                <div className="flex items-center space-x-2">
                  <input
                    {...register('changeStatus')}
                    type="checkbox"
                    id="changeStatus"
                    className="h-4 w-4 text-ems-blue focus:ring-ems-blue border-gray-300 rounded"
                  />
                  <label htmlFor="changeStatus" className="text-sm font-medium text-gray-700">
                    Change truck status with this maintenance record
                  </label>
                </div>

                {/* Status Selection - Only show if checkbox is checked */}
                {watch('changeStatus') && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="newStatus" className="block text-sm font-medium text-gray-700 mb-2">
                        New Status
                      </label>
                      <select
                        {...register('newStatus')}
                        id="newStatus"
                        className="input-field w-full"
                      >
                        <option value="in-service">In Service</option>
                        <option value="out-of-service">Out of Service</option>
                      </select>
                    </div>

                    {/* Out of Service Reason - Only show if Out of Service is selected */}
                    {watch('newStatus') === 'out-of-service' && (
                      <div>
                        <label htmlFor="outOfServiceReason" className="block text-sm font-medium text-gray-700 mb-2">
                          Reason for Out of Service
                        </label>
                        <textarea
                          {...register('outOfServiceReason')}
                          id="outOfServiceReason"
                          rows={2}
                          className="input-field w-full"
                          placeholder="Enter reason for being out of service..."
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Adding...' : 'Add Maintenance Record'}
            </button>
          </div>
        </form>
      )}

      {/* Equipment Tab */}
      {activeTab === 'equipment' && (
        <div className="space-y-6">
          {/* Equipment Form */}
          <form onSubmit={handleSubmitEquipment(onSubmitEquipment)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Truck Selection */}
              <div>
                <label htmlFor="equipmentTruckId" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Truck
                </label>
                <select
                  value={selectedTruckId || ''}
                  onChange={(e) => {
                    // Update the main form's truckId
                    const event = { target: { name: 'truckId', value: e.target.value } };
                    register('truckId').onChange(event);
                  }}
                  className="input-field w-full"
                >
                  <option value="">Choose a truck...</option>
                  {trucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      Unit {truck.unitNumber}
                    </option>
                  ))}
                </select>
              </div>

              {/* Equipment Type */}
              <div>
                <label htmlFor="equipmentType" className="block text-sm font-medium text-gray-700 mb-2">
                  Equipment Type
                </label>
                <select
                  {...registerEquipment('type')}
                  id="equipmentType"
                  className="input-field w-full"
                >
                  <option value="">Select type...</option>
                  <option value="stretcher">Stretcher</option>
                  <option value="lucas-device">Lucas Device</option>
                  <option value="lifepak-15">Life Pak 15</option>
                  <option value="stairchair">Stairchair</option>
                  <option value="handheld-radio">Handheld Radio</option>
                  <option value="ekg-battery-charger">EKG Battery Charger</option>
                  <option value="cot-battery-charger">Cot Battery Charger</option>
                </select>
                {equipmentErrors.type && (
                  <p className="mt-1 text-sm text-red-600">{equipmentErrors.type.message}</p>
                )}
              </div>

              {/* Serial Number */}
              <div>
                <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  Serial Number
                </label>
                <input
                  {...registerEquipment('serialNumber')}
                  type="text"
                  id="serialNumber"
                  className="input-field w-full"
                  placeholder="Equipment serial number"
                />
                {equipmentErrors.serialNumber && (
                  <p className="mt-1 text-sm text-red-600">{equipmentErrors.serialNumber.message}</p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="equipmentNotes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                {...registerEquipment('notes')}
                id="equipmentNotes"
                rows={2}
                className="input-field w-full"
                placeholder="Equipment notes..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || !selectedTruckId}
                className="btn-primary"
              >
                {loading ? 'Updating...' : 'Update Equipment'}
              </button>
            </div>
          </form>

          {/* Current Equipment Display */}
          {selectedTruck && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Current Equipment - Unit {selectedTruck.unitNumber}
              </h3>
              
              {selectedTruck.equipment && selectedTruck.equipment.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedTruck.equipment.map((equipment) => (
                    <div key={equipment.id} className="bg-gray-50 rounded-lg p-4 border">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 capitalize">
                          {equipment.type.replace('-', ' ')}
                        </h4>
                        <button
                          onClick={() => removeEquipment(equipment.id)}
                          className="text-red-500 hover:text-red-700"
                          title="Remove equipment"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600">
                        S/N: {equipment.serialNumber}
                      </p>
                      {equipment.notes && (
                        <p className="text-sm text-gray-500 mt-1">
                          {equipment.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No equipment assigned to this truck.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Status Tab */}
      {activeTab === 'status' && (
        <div className="space-y-4">
          {/* Truck Selection */}
          <div>
            <label htmlFor="statusTruckId" className="block text-sm font-medium text-gray-700 mb-2">
              Select Truck
            </label>
            <select
              id="statusTruckId"
              value={selectedTruckId || ''}
              onChange={(e) => {
                // Update the main form's truckId
                const event = { target: { name: 'truckId', value: e.target.value } };
                register('truckId').onChange(event);
              }}
              className="input-field w-full"
            >
              <option value="">Select a truck...</option>
              {trucks.map(truck => (
                <option key={truck.id} value={truck.id}>
                  Unit {truck.unitNumber} - {truck.vin}
                </option>
              ))}
            </select>
          </div>

          {selectedTruck && (
            <div className="space-y-4">
              {/* Current Status Display */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Current Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Unit Number</p>
                    <p className="text-lg text-gray-900">Unit {selectedTruck.unitNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Current Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedTruck.status === 'in-service' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedTruck.status === 'in-service' ? 'In Service' : 'Out of Service'}
                    </span>
                  </div>
                  {selectedTruck.status === 'out-of-service' && selectedTruck.outOfServiceReason && (
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-gray-700">Current Reason</p>
                      <p className="text-gray-900">{selectedTruck.outOfServiceReason}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Update Form */}
              <form onSubmit={handleSubmitStatus(onSubmitStatus)} className="space-y-4">
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                    New Status
                  </label>
                  <select
                    {...registerStatus('status')}
                    id="status"
                    className="input-field w-full"
                  >
                    <option value="in-service">In Service</option>
                    <option value="out-of-service">Out of Service</option>
                  </select>
                  {statusErrors.status && (
                    <p className="mt-1 text-sm text-red-600">{statusErrors.status.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="outOfServiceReason" className="block text-sm font-medium text-gray-700 mb-2">
                    Out of Service Reason (if applicable)
                  </label>
                  <textarea
                    {...registerStatus('outOfServiceReason')}
                    id="outOfServiceReason"
                    rows={3}
                    className="input-field w-full"
                    placeholder="Enter reason for being out of service..."
                  />
                  {statusErrors.outOfServiceReason && (
                    <p className="mt-1 text-sm text-red-600">{statusErrors.outOfServiceReason.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? 'Updating...' : 'Update Status'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MaintenanceForm;
