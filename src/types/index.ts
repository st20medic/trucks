export interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'user';
  createdAt: Date;
}

export interface Truck {
  id: string;
  unitNumber: string;
  vin: string;
  licensePlate: string;
  vehicleType: string;
  vehicleYear: number;
  status: 'in-service' | 'out-of-service';
  outOfServiceReason?: string;
  mileage: number;
  mileageLastUpdated?: Date; // Track when mileage was last updated
  photoURL?: string; // Firebase Storage URL for truck photo
  lastOilChange: Date;
  lastOilChangeMileage: number;
  inspectionStickerExpiry: Date;
  oemsInspectionExpiry: Date;
  lastBrakeChange: Date;
  lastBrakeChangeMileage: number;
  tireSize: string;
  lastTireChange: Date;
  lastTireChangeMileage: number;
  tireConfiguration: 'dual-rear' | 'single-rear'; // Whether truck has dual rear tires
  equipment: Equipment[];
  equipmentChangeHistory?: EquipmentChangeHistory[]; // Historical record of equipment changes
  lastMaintenanceAlertSent?: Date; // Track when the last maintenance alert email was sent
  alertsCleared?: {
    oilChange?: Date; // When oil change alert was last cleared
    inspection?: Date; // When inspection alert was last cleared
    oemsInspection?: Date; // When OEMS inspection alert was last cleared
    brakeChange?: Date; // When brake change alert was last cleared
    tireChange?: Date; // When tire change alert was last cleared
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface Equipment {
  id: string;
  type: 'stretcher' | 'lucas-device' | 'lifepak-15' | 'stairchair' | 'handheld-radio' | 'ekg-battery-charger' | 'cot-battery-charger';
  serialNumber: string;
  assignedDate: Date;
  notes?: string;
}

export interface EquipmentChangeHistory {
  id: string;
  truckId: string;
  equipmentType: Equipment['type'];
  oldSerialNumber?: string; // undefined for new equipment
  newSerialNumber: string;
  changeDate: Date;
  changeType: 'added' | 'updated' | 'removed';
  changedBy: string;
  notes?: string;
}

export interface MaintenanceRecord {
  id: string;
  truckId: string;
  truckUnitNumber: string;
  type: 'oil-change' | 'inspection' | 'brake-change' | 'tire-change' | 'other';
  description: string;
  date: Date;
  mileage: number;
  cost: number;
  performedBy: string;
  notes?: string;
  tiresChanged?: string[]; // Array of tire positions that were changed (e.g., ['FL', 'FR', 'RL'])
  createdAt: Date;
  createdBy: string;
}



export interface TruckStatus {
  unitNumber: string;
  status: 'in-service' | 'out-of-service';
  outOfServiceReason?: string;
  lastUpdate: Date;
}

export interface MaintenanceSchedule {
  truckId: string;
  unitNumber: string;
  nextOilChange: Date;
  nextOilChangeMileage: number;
  nextInspection: Date;
  nextOemsInspection: Date;
  nextBrakeCheck: Date;
  nextTireCheck: Date;
}

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  truckIds?: string[];
  maintenanceTypes?: string[];
  status?: string[];
}

export interface ExportData {
  trucks: Truck[];
  maintenanceRecords: MaintenanceRecord[];
  equipment: Equipment[];

  exportDate: Date;
  exportedBy: string;
}
