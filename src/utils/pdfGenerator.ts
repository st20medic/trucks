import jsPDF from 'jspdf';
import { Truck, MaintenanceRecord } from '../types';

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

export const generateTruckPDF = async (truck: Truck, maintenanceRecords: MaintenanceRecord[]) => {
  const doc = new jsPDF();
  
  // Set up fonts and styling
  doc.setFont('helvetica');
  
  // Header
  doc.setFontSize(24);
  doc.setTextColor(0, 0, 0);
  doc.text('Lincoln EMS - Truck Report', 105, 20, { align: 'center' });
  
  // Truck Information Section
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Truck Information', 20, 40);
  
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  
  let yPosition = 55;
  const lineHeight = 8;
  
  // Basic truck details
  doc.text(`Unit Number: ${truck.unitNumber}`, 20, yPosition);
  yPosition += lineHeight;
  
  doc.text(`VIN: ${truck.vin}`, 20, yPosition);
  yPosition += lineHeight;
  
  doc.text(`Status: ${truck.status === 'in-service' ? 'In Service' : 'Out of Service'}`, 20, yPosition);
  yPosition += lineHeight;
  
  if (truck.status === 'out-of-service' && truck.outOfServiceReason) {
    doc.text(`Out of Service Reason: ${truck.outOfServiceReason}`, 20, yPosition);
    yPosition += lineHeight;
  }
  
  doc.text(`Current Mileage: ${truck.mileage.toLocaleString()}`, 20, yPosition);
  yPosition += lineHeight;
  
  doc.text(`Tire Size: ${truck.tireSize || 'Not specified'}`, 20, yPosition);
  yPosition += lineHeight;
  
  yPosition += lineHeight; // Add some space
  
  // Maintenance Information
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Maintenance Information', 20, yPosition);
  
  yPosition += lineHeight;
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  
  doc.text(`Last Oil Change: ${truck.lastOilChangeMileage.toLocaleString()} miles`, 20, yPosition);
  yPosition += lineHeight;
  
  doc.text(`Oil Change Due: ${(truck.lastOilChangeMileage + 5000).toLocaleString()} miles`, 20, yPosition);
  yPosition += lineHeight;
  
  doc.text(`Last Brake Change: ${truck.lastBrakeChangeMileage.toLocaleString()} miles`, 20, yPosition);
  yPosition += lineHeight;
  
  doc.text(`Last Tire Change: ${truck.lastTireChangeMileage.toLocaleString()} miles`, 20, yPosition);
  yPosition += lineHeight;
  
  yPosition += lineHeight; // Add some space
  
  // Equipment Section
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Equipment', 20, yPosition);
  
  yPosition += lineHeight;
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  
  if (truck.equipment && truck.equipment.length > 0) {
    sortEquipmentByOrder(truck.equipment).forEach((item) => {
      doc.text(`${item.type.replace('-', ' ').toUpperCase()}: ${item.serialNumber}`, 20, yPosition);
      yPosition += lineHeight;
      if (item.notes) {
        doc.text(`  Notes: ${item.notes}`, 25, yPosition);
        yPosition += lineHeight;
      }
    });
  } else {
    doc.text('No equipment assigned', 20, yPosition);
    yPosition += lineHeight;
  }
  
  yPosition += lineHeight; // Add some space
  
  // Equipment Change History Section
  if (truck.equipmentChangeHistory && truck.equipmentChangeHistory.length > 0) {
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Equipment Change History', 20, yPosition);
    
    yPosition += lineHeight;
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    
    // Sort by date (newest first)
    const sortedHistory = truck.equipmentChangeHistory
      .sort((a, b) => new Date(b.changeDate).getTime() - new Date(a.changeDate).getTime())
      .slice(0, 20); // Limit to last 20 changes to avoid PDF overflow
    
    sortedHistory.forEach((change) => {
      const changeDate = new Date(change.changeDate).toLocaleDateString();
      const changeType = change.changeType.charAt(0).toUpperCase() + change.changeType.slice(1);
      const equipmentType = change.equipmentType.replace('-', ' ').toUpperCase();
      
      let changeText = `${changeDate} - ${changeType} ${equipmentType}`;
      
      if (change.changeType === 'updated' && change.oldSerialNumber) {
        changeText += ` (${change.oldSerialNumber} → ${change.newSerialNumber})`;
      } else if (change.changeType === 'added') {
        changeText += ` (S/N: ${change.newSerialNumber})`;
      } else if (change.changeType === 'removed' && change.oldSerialNumber) {
        changeText += ` (S/N: ${change.oldSerialNumber})`;
      }
      
      doc.text(changeText, 20, yPosition);
      yPosition += lineHeight;
      
      // Check if we need a new page
      if (yPosition > 280) {
        doc.addPage();
        yPosition = 20;
      }
    });
  }
  
  yPosition += lineHeight; // Add some space
  
  // Maintenance History Section
  if (maintenanceRecords.length > 0) {
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Maintenance History', 20, yPosition);
    
    yPosition += lineHeight;
    doc.setFontSize(10); // Smaller font for history
    
    // Sort maintenance records by date (newest first)
    const sortedMaintenanceRecords = [...maintenanceRecords].sort((a, b) => {
      // Helper function to get date as timestamp
      const getDateTimestamp = (record: MaintenanceRecord): number => {
        try {
          if (record.date) {
            // Check if it's a Firestore Timestamp (has toDate method)
            if (typeof record.date === 'object' && record.date !== null && 'toDate' in record.date && typeof (record.date as any).toDate === 'function') {
              // Firestore Timestamp
              return (record.date as any).toDate().getTime();
            } else if (record.date instanceof Date) {
              // Date object
              return record.date.getTime();
            } else {
              // Date string or other format
              return new Date(record.date as any).getTime();
            }
          }
        } catch (error) {
          console.error('Error parsing date for sorting:', error, 'Date value:', record.date);
        }
        return 0; // Default to 0 if date is invalid
      };
      
      const dateA = getDateTimestamp(a);
      const dateB = getDateTimestamp(b);
      
      // Sort descending (newest first)
      return dateB - dateA;
    });
    
    sortedMaintenanceRecords.forEach((record) => {
      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      // Handle different date formats (Date objects, Firestore Timestamps, or date strings)
      let formattedDate = 'Invalid Date';
      try {
        if (record.date) {
          // Check if it's a Firestore Timestamp (has toDate method)
          if (typeof record.date === 'object' && record.date !== null && 'toDate' in record.date && typeof (record.date as any).toDate === 'function') {
            // Firestore Timestamp
            formattedDate = (record.date as any).toDate().toLocaleDateString();
          } else if (record.date instanceof Date) {
            // Date object
            formattedDate = record.date.toLocaleDateString();
          } else {
            // Date string or other format
            formattedDate = new Date(record.date as any).toLocaleDateString();
          }
        }
      } catch (error) {
        console.error('Error formatting date:', error, 'Date value:', record.date);
        formattedDate = 'Invalid Date';
      }
      
      doc.text(`${record.type.replace('-', ' ').toUpperCase()} - ${formattedDate}`, 20, yPosition);
      yPosition += lineHeight;
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Mileage: ${record.mileage.toLocaleString()}`, 25, yPosition);
      yPosition += lineHeight;
      
      doc.text(`Cost: $${record.cost.toLocaleString()}`, 25, yPosition);
      yPosition += lineHeight;
      
      doc.text(`Performed by: ${record.performedBy}`, 25, yPosition);
      yPosition += lineHeight;
      
      if (record.description) {
        const descriptionText = `Description: ${record.description}`;
        const splitDescription = doc.splitTextToSize(descriptionText, 165); // 165mm width for A4 page
        doc.text(splitDescription, 25, yPosition);
        yPosition += lineHeight * splitDescription.length;
      }
      
      if (record.notes) {
        const notesText = `Notes: ${record.notes}`;
        const splitNotes = doc.splitTextToSize(notesText, 165); // 165mm width for A4 page
        doc.text(splitNotes, 25, yPosition);
        yPosition += lineHeight * splitNotes.length;
      }
      
      yPosition += lineHeight; // Add space between records
    });
  }
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, 280);
    doc.text(`Page ${i} of ${pageCount}`, 170, 280);
  }
  
  // Save the PDF
  doc.save(`Lincoln-EMS-Truck-${truck.unitNumber}-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateAllTrucksPDF = async (trucks: Truck[], maintenanceRecords: MaintenanceRecord[]) => {
  const doc = new jsPDF();
  
  // Set up fonts and styling
  doc.setFont('helvetica');
  
  // Header
  doc.setFontSize(24);
  doc.setTextColor(0, 0, 0);
  doc.text('Lincoln EMS - Fleet Report', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 105, 30, { align: 'center' });
  
  let yPosition = 45;
  const lineHeight = 8;
  
  // Fleet Summary
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Fleet Summary', 20, yPosition);
  
  yPosition += lineHeight;
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  
  const inServiceCount = trucks.filter(t => t.status === 'in-service').length;
  const outOfServiceCount = trucks.filter(t => t.status === 'out-of-service').length;
  
  doc.text(`Total Trucks: ${trucks.length}`, 20, yPosition);
  yPosition += lineHeight;
  doc.text(`In Service: ${inServiceCount}`, 20, yPosition);
  yPosition += lineHeight;
  doc.text(`Out of Service: ${outOfServiceCount}`, 20, yPosition);
  yPosition += lineHeight;
  
  yPosition += lineHeight; // Add some space
  
  // Maintenance Summary
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Maintenance Summary', 20, yPosition);
  
  yPosition += lineHeight;
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  
  const totalMaintenanceRecords = maintenanceRecords.length;
  const recentMaintenance = maintenanceRecords.filter(record => {
    let recordDate: Date;
    try {
      if (record.date) {
        // Check if it's a Firestore Timestamp (has toDate method)
        if (typeof record.date === 'object' && record.date !== null && 'toDate' in record.date && typeof (record.date as any).toDate === 'function') {
          // Firestore Timestamp
          recordDate = (record.date as any).toDate();
        } else if (record.date instanceof Date) {
          // Date object
          recordDate = record.date;
        } else {
          // Date string or other format
          recordDate = new Date(record.date as any);
        }
      } else {
        return false; // Skip records without dates
      }
    } catch (error) {
      console.error('Error parsing record date:', error, 'Date value:', record.date);
      return false; // Skip records with invalid dates
    }
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return recordDate > thirtyDaysAgo;
  }).length;
  
  doc.text(`Total Maintenance Records: ${totalMaintenanceRecords}`, 20, yPosition);
  yPosition += lineHeight;
  doc.text(`Maintenance in Last 30 Days: ${recentMaintenance}`, 20, yPosition);
  yPosition += lineHeight;
  
  yPosition += lineHeight; // Add some space
  
  // Individual Truck Summaries
  trucks.forEach((truck) => {
    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    
    // Calculate total repair costs for this truck
    const truckMaintenanceRecords = maintenanceRecords.filter(record => record.truckId === truck.id);
    const totalRepairCosts = truckMaintenanceRecords.reduce((total, record) => total + (record.cost || 0), 0);
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Unit ${truck.unitNumber}`, 20, yPosition);
    
    // Display total repair costs to the right of unit number
    doc.setFontSize(12);
    doc.setTextColor(50, 100, 50);
    doc.text(`Total Repair Costs: $${totalRepairCosts.toLocaleString()}`, 120, yPosition);
    
    yPosition += lineHeight;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    
    doc.text(`Status: ${truck.status === 'in-service' ? 'In Service' : 'Out of Service'}`, 25, yPosition);
    yPosition += lineHeight;
    
    doc.text(`Mileage: ${truck.mileage.toLocaleString()}`, 25, yPosition);
    yPosition += lineHeight;
    
    doc.text(`Equipment: ${truck.equipment?.length || 0} items`, 25, yPosition);
    yPosition += lineHeight;
    
    if (truck.status === 'out-of-service' && truck.outOfServiceReason) {
      doc.text(`Out of Service: ${truck.outOfServiceReason}`, 25, yPosition);
      yPosition += lineHeight;
    }
    
    yPosition += lineHeight; // Add space between trucks
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, 280);
    doc.text(`Page ${i} of ${pageCount}`, 170, 280);
  }
  
  // Save the PDF
  doc.save(`Lincoln-EMS-Fleet-Report-${new Date().toISOString().split('T')[0]}.pdf`);
};


