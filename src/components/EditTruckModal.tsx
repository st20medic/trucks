import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Save, Upload, Trash2, Edit3, Plus, Minus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Truck as TruckType, Equipment } from '../types';

const editTruckSchema = z.object({
  unitNumber: z.string().min(1, 'Unit number is required'),
  vin: z.string().min(17, 'VIN must be at least 17 characters').max(17, 'VIN must be exactly 17 characters'),
  licensePlate: z.string().min(1, 'License plate is required'),
  vehicleType: z.string().min(1, 'Vehicle type is required'),
  vehicleYear: z.number().min(1900, 'Vehicle year must be after 1900').max(new Date().getFullYear() + 1, 'Vehicle year cannot be in the future'),
  mileage: z.number().min(0, 'Mileage must be positive'),
  status: z.enum(['in-service', 'out-of-service']),
  outOfServiceReason: z.string().optional(),
  tireSize: z.string().min(1, 'Tire size is required'),
  tireConfiguration: z.enum(['dual-rear', 'single-rear']),
  inspectionStickerExpiry: z.string().min(1, 'WV Inspection expiry date is required'),
  oemsInspectionExpiry: z.string().min(1, 'OEMS Inspection expiry date is required'),
  photo: z.instanceof(File).optional(),
});

type EditTruckFormData = z.infer<typeof editTruckSchema>;

interface EditTruckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EditTruckFormData & { equipment: Equipment[] }) => Promise<void>;
  truck: TruckType | null;
}

const EditTruckModal: React.FC<EditTruckModalProps> = ({ isOpen, onClose, onSubmit, truck }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Equipment form state
  const [newEquipment, setNewEquipment] = useState<{
    type: Equipment['type'];
    serialNumber: string;
    notes: string;
  }>({
    type: 'stretcher',
    serialNumber: '',
    notes: ''
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
    watch,
  } = useForm<EditTruckFormData>({
    resolver: zodResolver(editTruckSchema),
  });

  const selectedStatus = watch('status');

  // Initialize form with truck data when modal opens
  useEffect(() => {
    if (truck && isOpen) {
      setValue('unitNumber', truck.unitNumber);
      setValue('vin', truck.vin);
      setValue('licensePlate', truck.licensePlate);
      setValue('vehicleType', truck.vehicleType);
      setValue('vehicleYear', truck.vehicleYear);
      setValue('mileage', truck.mileage);
      setValue('status', truck.status);
      setValue('outOfServiceReason', truck.outOfServiceReason || '');
      setValue('tireSize', truck.tireSize);
      setValue('tireConfiguration', truck.tireConfiguration || 'single-rear');
      setValue('inspectionStickerExpiry', new Date(truck.inspectionStickerExpiry).toISOString().split('T')[0]);
      setValue('oemsInspectionExpiry', new Date(truck.oemsInspectionExpiry).toISOString().split('T')[0]);
      
      // Initialize equipment
      setEquipment(truck.equipment || []);
      
      // Initialize photo states with existing photo if available
      if (truck.photoURL) {
        setPhotoPreview(truck.photoURL);
        setPhotoFile(null); // No new file selected
      } else {
        setPhotoFile(null);
        setPhotoPreview(null);
      }
    }
  }, [truck, isOpen, setValue]);

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (JPEG, PNG, etc.)');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image file size must be less than 5MB');
        return;
      }

      setPhotoFile(file);
      setValue('photo', file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setValue('photo', undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Equipment management functions
  const addEquipment = () => {
    if (newEquipment.serialNumber.trim()) {
      const equipmentItem: Equipment = {
        id: `equipment-${Date.now()}`,
        type: newEquipment.type,
        serialNumber: newEquipment.serialNumber.trim(),
        assignedDate: new Date(),
        notes: newEquipment.notes.trim() || ''
      };
      
      setEquipment([...equipment, equipmentItem]);
      setNewEquipment({
        type: 'stretcher' as Equipment['type'],
        serialNumber: '',
        notes: ''
      });
    }
  };

  const removeEquipment = (id: string) => {
    setEquipment(equipment.filter(item => item.id !== id));
  };

  const handleFormSubmit = async (data: EditTruckFormData) => {
    if (!user || !truck) return;
    
    setLoading(true);
    setSuccessMessage(null);

    try {
      // Include photo file and equipment in the data
      const submitData = {
        ...data,
        ...(photoFile && { photo: photoFile }),
        equipment: equipment
      };
      
      await onSubmit(submitData);
      setSuccessMessage('Truck updated successfully!');
      
      // Close modal after a short delay to show success message
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1500);
    } catch (error) {
      console.error('Error updating truck:', error);
      setSuccessMessage('Error updating truck. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      reset();
      setSuccessMessage(null);
      setPhotoFile(null);
      setPhotoPreview(null);
      onClose();
    }
  };

  if (!isOpen || !truck) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-ems-blue rounded-lg flex items-center justify-center">
              <Edit3 className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Edit Truck - Unit {truck.unitNumber}</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className={`mx-6 mt-4 p-3 rounded-md ${
            successMessage.includes('Error') 
              ? 'bg-red-50 text-red-700 border border-red-200' 
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {successMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4">
          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Truck Photo (Optional)
            </label>
            
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Truck preview"
                  className="w-full h-32 object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  title="Remove photo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-ems-blue transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="flex flex-col items-center space-y-2 text-gray-500 hover:text-ems-blue transition-colors"
                >
                  <Upload className="h-8 w-8" />
                  <span className="text-sm font-medium">Click to upload new photo</span>
                  <span className="text-xs">JPEG, PNG up to 5MB</span>
                </button>
              </div>
            )}
          </div>

          {/* Unit Number */}
          <div>
            <label htmlFor="unitNumber" className="block text-sm font-medium text-gray-700 mb-2">
              Unit Number *
            </label>
            <input
              {...register('unitNumber')}
              type="text"
              id="unitNumber"
              className="input-field w-full"
              placeholder="e.g., 52, 53, 55..."
              disabled={loading}
            />
            {errors.unitNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.unitNumber.message}</p>
            )}
          </div>

          {/* VIN */}
          <div>
            <label htmlFor="vin" className="block text-sm font-medium text-gray-700 mb-2">
              VIN Number *
            </label>
            <input
              {...register('vin')}
              type="text"
              id="vin"
              className="input-field w-full font-mono"
              placeholder="17-character VIN"
              maxLength={17}
              disabled={loading}
            />
            {errors.vin && (
              <p className="mt-1 text-sm text-red-600">{errors.vin.message}</p>
            )}
          </div>

          {/* License Plate */}
          <div>
            <label htmlFor="licensePlate" className="block text-sm font-medium text-gray-700 mb-2">
              License Plate *
            </label>
            <input
              {...register('licensePlate')}
              type="text"
              id="licensePlate"
              className="input-field w-full"
              placeholder="e.g., ABC123, 123XYZ"
              disabled={loading}
            />
            {errors.licensePlate && (
              <p className="mt-1 text-sm text-red-600">{errors.licensePlate.message}</p>
            )}
          </div>

          {/* Vehicle Type */}
          <div>
            <label htmlFor="vehicleType" className="block text-sm font-medium text-gray-700 mb-2">
              Vehicle Type *
            </label>
            <input
              {...register('vehicleType')}
              type="text"
              id="vehicleType"
              className="input-field w-full"
              placeholder="e.g., Ford E-350, Chevy, Dodge Ram"
              disabled={loading}
            />
            {errors.vehicleType && (
              <p className="mt-1 text-sm text-red-600">{errors.vehicleType.message}</p>
            )}
          </div>

          {/* Vehicle Year */}
          <div>
            <label htmlFor="vehicleYear" className="block text-sm font-medium text-gray-700 mb-2">
              Vehicle Year *
            </label>
            <input
              {...register('vehicleYear', { valueAsNumber: true })}
              type="number"
              id="vehicleYear"
              className="input-field w-full"
              placeholder="e.g., 2020"
              min="1900"
              max={new Date().getFullYear() + 1}
              disabled={loading}
            />
            {errors.vehicleYear && (
              <p className="mt-1 text-sm text-red-600">{errors.vehicleYear.message}</p>
            )}
          </div>

          {/* Mileage */}
          <div>
            <label htmlFor="mileage" className="block text-sm font-medium text-gray-700 mb-2">
              Current Mileage *
            </label>
            <input
              {...register('mileage', { valueAsNumber: true })}
              type="number"
              id="mileage"
              className="input-field w-full"
              placeholder="0"
              min="0"
              disabled={loading}
            />
            {errors.mileage && (
              <p className="mt-1 text-sm text-red-600">{errors.mileage.message}</p>
            )}
          </div>

          {/* WV Inspection Sticker Expiry */}
          <div>
            <label htmlFor="inspectionStickerExpiry" className="block text-sm font-medium text-gray-700 mb-2">
              WV Inspection Sticker Expiry *
            </label>
            <input
              {...register('inspectionStickerExpiry')}
              type="date"
              id="inspectionStickerExpiry"
              className="input-field w-full"
              disabled={loading}
            />
            {errors.inspectionStickerExpiry && (
              <p className="mt-1 text-sm text-red-600">{errors.inspectionStickerExpiry.message}</p>
            )}
          </div>

          {/* OEMS Inspection Sticker Expiry */}
          <div>
            <label htmlFor="oemsInspectionExpiry" className="block text-sm font-medium text-gray-700 mb-2">
              OEMS Inspection Sticker Expiry *
            </label>
            <input
              {...register('oemsInspectionExpiry')}
              type="date"
              id="oemsInspectionExpiry"
              className="input-field w-full"
              disabled={loading}
            />
            {errors.oemsInspectionExpiry && (
              <p className="mt-1 text-sm text-red-600">{errors.oemsInspectionExpiry.message}</p>
            )}
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
              Status *
            </label>
            <select
              {...register('status')}
              id="status"
              className="input-field w-full"
              disabled={loading}
            >
              <option value="in-service">In Service</option>
              <option value="out-of-service">Out of Service</option>
            </select>
            {errors.status && (
              <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
            )}
          </div>

          {/* Out of Service Reason */}
          {selectedStatus === 'out-of-service' && (
            <div>
              <label htmlFor="outOfServiceReason" className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Out of Service
              </label>
              <textarea
                {...register('outOfServiceReason')}
                id="outOfServiceReason"
                rows={2}
                className="input-field w-full"
                placeholder="Describe why the truck is out of service..."
                disabled={loading}
              />
              {errors.outOfServiceReason && (
                <p className="mt-1 text-sm text-red-600">{errors.outOfServiceReason.message}</p>
              )}
            </div>
          )}

          {/* Tire Size */}
          <div>
            <label htmlFor="tireSize" className="block text-sm font-medium text-gray-700 mb-2">
              Tire Size *
            </label>
            <input
              {...register('tireSize')}
              type="text"
              id="tireSize"
              className="input-field w-full"
              placeholder="e.g., 225/75R16"
              disabled={loading}
            />
            {errors.tireSize && (
              <p className="mt-1 text-sm text-red-600">{errors.tireSize.message}</p>
            )}
          </div>

          {/* Tire Configuration */}
          <div>
            <label htmlFor="tireConfiguration" className="block text-sm font-medium text-gray-700 mb-2">
              Tire Configuration *
            </label>
            <select
              {...register('tireConfiguration')}
              id="tireConfiguration"
              className="input-field w-full"
              disabled={loading}
            >
              <option value="single-rear">Single Rear Tires (2 rear tires)</option>
              <option value="dual-rear">Dual Rear Tires (4 rear tires)</option>
            </select>
            {errors.tireConfiguration && (
              <p className="mt-1 text-sm text-red-600">{errors.tireConfiguration.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Single rear: FL, FR, RL, RR | Dual rear: FL, FR, RLI, RLO, RRI, RRO
            </p>
          </div>

          {/* Equipment Management */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Equipment</h3>
            {equipment.length === 0 ? (
              <p className="text-sm text-gray-500">No equipment assigned to this truck.</p>
            ) : (
              <div className="space-y-3">
                {equipment.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{item.type.replace('-', ' ')}</p>
                      <p className="text-sm text-gray-700">{item.serialNumber}</p>
                      {item.notes && <p className="text-xs text-gray-500">{item.notes}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEquipment(item.id)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                      title="Remove equipment"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-center space-x-2">
              <select
                value={newEquipment.type}
                onChange={(e) => setNewEquipment({ ...newEquipment, type: e.target.value as Equipment['type'] })}
                className="input-field w-full"
                disabled={loading}
              >
                <option value="stretcher">Stretcher</option>
                <option value="lucas-device">Lucas Device</option>
                <option value="lifepak-15">Life Pak 15</option>
                <option value="stairchair">Stairchair</option>
                <option value="handheld-radio">Handheld Radio</option>
                <option value="ekg-battery-charger">EKG Battery Charger</option>
                <option value="cot-battery-charger">Cot Battery Charger</option>
              </select>
              <input
                type="text"
                placeholder="Serial Number"
                value={newEquipment.serialNumber}
                onChange={(e) => setNewEquipment({ ...newEquipment, serialNumber: e.target.value })}
                className="input-field w-full"
                disabled={loading}
              />
              <button
                type="button"
                onClick={addEquipment}
                disabled={loading}
                className="btn-primary flex-1 flex items-center justify-center"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Equipment
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Updating...' : 'Update Truck'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTruckModal;
