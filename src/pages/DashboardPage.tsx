import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTrucks } from '../contexts/TruckContext';
import Header from '../components/Header';
import TruckCard from '../components/TruckCard';
import MaintenanceForm from '../components/MaintenanceForm';
import AddTruckModal from '../components/AddTruckModal';
import EditTruckModal from '../components/EditTruckModal';
import UpdateMileagesModal from '../components/UpdateMileagesModal';

import { addTruck, updateTruck, importData, clearMaintenanceAlert } from '../services/firebase';
// import { logTruckAction } from '../services/auditLogger';
import { Truck, Equipment } from '../types';
import { generateTruckPDF, generateAllTrucksPDF } from '../utils/pdfGenerator';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { trucks, maintenanceRecords, loading, error } = useTrucks();
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showAddTruckModal, setShowAddTruckModal] = useState(false);
  const [showEditTruckModal, setShowEditTruckModal] = useState(false);
  const [showUpdateMileagesModal, setShowUpdateMileagesModal] = useState(false);

  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);

  // Debug logging
  console.log('DashboardPage: Rendering with:', { user: user?.email, trucksCount: trucks?.length, loading, error });

  const handlePrintAll = async () => {
    try {
      await generateAllTrucksPDF(trucks, maintenanceRecords);
    } catch (error) {
      console.error('Error generating fleet PDF:', error);
      alert('Error generating fleet PDF. Please try again.');
    }
  };

  const handlePrintTruck = async (truckId: string) => {
    try {
      const truck = trucks.find(t => t.id === truckId);
      if (truck) {
        // Filter maintenance records for this specific truck
        const truckMaintenanceRecords = maintenanceRecords.filter(record => record.truckId === truckId);
        await generateTruckPDF(truck, truckMaintenanceRecords);
      }
    } catch (error) {
      console.error('Error generating truck PDF:', error);
      alert('Error generating truck PDF. Please try again.');
    }
  };

  const handleExportData = () => {
    const data = {
      trucks,
      exportDate: new Date().toISOString(),
      exportedBy: user?.email || 'Unknown'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trucks-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!user) {
      alert('User not logged in. Please log in to import data.');
      return;
    }

    try {
      // Read and parse the JSON file
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate the data structure
      if (!data.trucks || !Array.isArray(data.trucks)) {
        throw new Error('Invalid data format: trucks array not found');
      }

      // Import the data
      const results = await importData(data, user.uid);
      
      // Show results
      const message = `Import completed!\nTrucks: ${results.trucks.imported} imported, ${results.trucks.errors} errors\nMaintenance: ${results.maintenanceRecords.imported} imported, ${results.maintenanceRecords.errors} errors`;
      
      if (results.errors.length > 0) {
        alert(`${message}\n\nErrors:\n${results.errors.slice(0, 5).join('\n')}${results.errors.length > 5 ? '\n...and more' : ''}`);
      } else {
        alert(message);
      }

      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Error importing data:', error);
      alert(`Error importing data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Clear the file input on error
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };




  const handleAddTruck = async (data: { 
    unitNumber: string; 
    vin: string; 
    licensePlate: string;
    vehicleType: string;
    vehicleYear: number;
    mileage: number; 
    status: 'in-service' | 'out-of-service';
    outOfServiceReason?: string;
    tireSize: string;
    inspectionStickerExpiry: string;
    oemsInspectionExpiry: string;
    photo?: File;
    equipment: Equipment[];
  }) => {
    if (!user) return;
    
    try {
      console.log('Adding new truck:', data);
      
      if (data.photo) {
        console.log('Photo file:', data.photo.name, 'Size:', data.photo.size, 'Type:', data.photo.type);
        // TODO: Upload photo to Firebase Storage and get URL
      }
      
      // Add truck to Firebase
      const newTruck = await addTruck(data, user.uid);
      console.log('Truck added successfully with ID:', newTruck.id);
      
      // Log the action (temporarily disabled for debugging)
      // await logTruckAction('create', newTruck.id, user.uid, user.email || 'Unknown', {
      //   unitNumber: data.unitNumber,
      //   vin: data.vin,
      //   vehicleType: data.vehicleType,
      //   vehicleYear: data.vehicleYear,
      //   mileage: data.mileage,
      //   status: data.status,
      //   equipment: data.equipment
      // });
      
      // The TruckContext will automatically update via real-time listener
      // No need to manually update local state
      
    } catch (error) {
      console.error('Error adding truck:', error);
      throw error; // This will be caught by the modal and show error message
    }
  };

  const handleEditTruck = async (data: { 
    unitNumber: string; 
    vin: string; 
    licensePlate: string;
    vehicleType: string;
    vehicleYear: number;
    mileage: number; 
    status: 'in-service' | 'out-of-service';
    outOfServiceReason?: string;
    tireSize: string;
    inspectionStickerExpiry: string;
    oemsInspectionExpiry: string;
    photo?: File;
    equipment: Equipment[];
  }) => {
    if (!selectedTruck || !user) return;
    
    try {
      console.log('Updating truck:', selectedTruck.id, 'with data:', data);
      console.log('Equipment being updated:', data.equipment);
      
      if (data.photo) {
        console.log('New photo file:', data.photo.name, 'Size:', data.photo.size, 'Type:', data.photo.type);
        // TODO: Upload photo to Firebase Storage and get URL
      }
      
      // Update truck in Firebase
      const updates = {
        unitNumber: data.unitNumber,
        vin: data.vin,
        licensePlate: data.licensePlate,
        vehicleType: data.vehicleType,
        vehicleYear: data.vehicleYear,
        mileage: data.mileage,
        ...(data.mileage !== selectedTruck.mileage && { mileageLastUpdated: new Date() }), // Track when mileage was updated
        status: data.status,
        outOfServiceReason: data.status === 'out-of-service' ? data.outOfServiceReason : '',
        tireSize: data.tireSize,
        inspectionStickerExpiry: new Date(data.inspectionStickerExpiry),
        oemsInspectionExpiry: new Date(data.oemsInspectionExpiry),
        photo: data.photo, // Include photo for upload processing
        equipment: data.equipment, // Include equipment updates
      };
      
      await updateTruck(selectedTruck.id, updates, user.uid, selectedTruck);
      console.log('Truck updated successfully');
      
      // Log the action (temporarily disabled for debugging)
      // await logTruckAction('update', selectedTruck.id, user.uid, user.email || 'Unknown', updates);
      
      // The TruckContext will automatically update via real-time listener
      // No need to manually update local state
      
    } catch (error) {
      console.error('Error updating truck:', error);
      throw error; // This will be caught by the modal and show error message
    }
  };

  const handleEditClick = (truck: Truck) => {
    setSelectedTruck(truck);
    setShowEditTruckModal(true);
  };



  const handleCloseEditModal = () => {
    setShowEditTruckModal(false);
    setSelectedTruck(null);
  };

  const handleClearAlert = async (truckId: string, alertType: string, notes: string) => {
    try {
      await clearMaintenanceAlert(truckId, alertType, notes, user?.uid);
      console.log(`Alert cleared for truck ${truckId}, type: ${alertType}`);
    } catch (error) {
      console.error('Error clearing alert:', error);
      throw error; // Re-throw so the modal can handle the error
    }
  };

  if (loading && (!trucks || trucks.length === 0)) {
    console.log('DashboardPage: About to render with loading:', loading, 'error:', error);
    console.log('DashboardPage: Showing loading state');
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center max-w-md mx-auto">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-ems-blue mx-auto mb-6"></div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Connecting to Database</h3>
              <p className="text-gray-600 mb-4">Loading truck data from Firebase...</p>
              
              {/* Mobile-specific loading tips */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                <h4 className="font-medium text-blue-800 mb-2">Please wait:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• This may take a few moments on mobile</li>
                  <li>• Ensure you have a stable internet connection</li>
                  <li>• Don't close the browser tab</li>
                </ul>
              </div>
              
              {/* Progress indicator */}
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-ems-blue h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Establishing connection...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-md mx-auto">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-red-800 mb-3">Connection Issue</h2>
            <p className="text-red-600 mb-4 text-sm">{error}</p>
            
            {/* Mobile-specific guidance */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
              <h3 className="font-semibold text-blue-800 mb-2">Mobile Device Tips:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Check your internet connection</li>
                <li>• Try switching between WiFi and cellular</li>
                <li>• Close and reopen the app</li>
                <li>• Ensure you're not in airplane mode</li>
              </ul>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary"
              >
                Refresh Page
              </button>
              <button
                onClick={() => window.history.back()}
                className="btn-secondary"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  console.log('DashboardPage: Rendering main dashboard with', trucks?.length, 'trucks');

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Fleet Summary */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">Fleet Summary</h2>
            {loading && (
              <p className="text-sm text-gray-500">Loading latest data...</p>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-ems-blue">
                {trucks?.length || 0}
              </div>
              <div className="text-sm text-gray-600">Total Trucks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-ems-green">
                {trucks?.filter(t => t.status === 'in-service').length || 0}
              </div>
              <div className="text-sm text-gray-600">In Service</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-ems-red">
                {trucks?.filter(t => t.status === 'out-of-service').length || 0}
              </div>
              <div className="text-sm text-gray-600">Out of Service</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-ems-yellow">
                {trucks?.filter(t => t.mileage > (t.lastOilChangeMileage || 0) + 5000).length || 0}
              </div>
              <div className="text-sm text-gray-600">Maintenance Due</div>
            </div>
          </div>
        </div>

        {/* Truck Grid - Hidden when maintenance form is shown */}
        {!showMaintenanceForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Fleet Overview</h2>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowMaintenanceForm(!showMaintenanceForm)}
                  className="btn-secondary"
                >
                  Show Maintenance Form
                </button>
                <button
                  onClick={() => setShowUpdateMileagesModal(true)}
                  className="btn-secondary"
                >
                  Update Mileages
                </button>
                <button
                  onClick={() => setShowAddTruckModal(true)}
                  className="btn-primary"
                >
                  Add New Truck
                </button>
              </div>
            </div>

            {trucks && trucks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {trucks
                  .sort((a, b) => parseInt(a.unitNumber) - parseInt(b.unitNumber))
                  .map((truck) => (
                  <TruckCard
                    key={truck.id}
                    truck={truck}
                    maintenanceRecords={maintenanceRecords}
                    onPrint={handlePrintTruck}
                    onEdit={() => {
                      console.log('Edit button clicked for truck:', { id: truck.id, unitNumber: truck.unitNumber });
                      handleEditClick(truck);
                    }}
                    onClearAlert={handleClearAlert}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No trucks found in the database.</p>
                <p className="text-gray-400 text-sm mt-2">Click "Add New Truck" to get started.</p>
              </div>
            )}
          </div>
        )}

        {/* Maintenance Form */}
        {showMaintenanceForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Maintenance Form</h2>
              <button
                onClick={() => setShowMaintenanceForm(false)}
                className="btn-secondary"
              >
                Hide Maintenance Form
              </button>
            </div>
            <MaintenanceForm />
          </div>
        )}

        {/* Global Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Global Actions</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handlePrintAll}
              className="btn-secondary"
            >
              Print All Trucks
            </button>
            <button
              onClick={handleExportData}
              className="btn-secondary"
            >
              Export Data (JSON)
            </button>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleImportData}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
            >
              Import Data (JSON)
            </button>


          </div>
        </div>
      </div>

      {/* Add Truck Modal */}
      <AddTruckModal
        isOpen={showAddTruckModal}
        onClose={() => setShowAddTruckModal(false)}
        onSubmit={handleAddTruck}
      />

      {/* Edit Truck Modal */}
      <EditTruckModal
        isOpen={showEditTruckModal}
        onClose={handleCloseEditModal}
        onSubmit={handleEditTruck}
        truck={selectedTruck}
      />

      {/* Update Mileages Modal */}
      <UpdateMileagesModal
        isOpen={showUpdateMileagesModal}
        onClose={() => setShowUpdateMileagesModal(false)}
        trucks={trucks}
        onUpdate={() => {
          // This will trigger a refresh of the truck data
          console.log('Mileages updated, data should refresh automatically');
        }}
      />


    </div>
  );
};

export default DashboardPage;
