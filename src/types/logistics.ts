export interface Consignment {
  id: string;
  trackingNumber: string;
  itemDescription: string;
  minTempC: number;
  maxTempC: number;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  urgency: 'Standard' | 'Expedited' | 'Life-Critical';
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  recipientPhone: string;
  recipientEmail: string;
  recipientName: string;
  status:
    | 'Awaiting_Assignment'
    | 'Assigned'
    | 'In_Transit'
    | 'Temperature_Breach'
    | 'Arrived_At_Destination'
    | 'Delivered'
    | 'Delivery_Locked';
  assignedVehicleId?: string;
  assignedDriverId?: string;
  createdAt: string;
  currentLat?: number;
  currentLng?: number;
  currentTempC?: number;
  remainingDistanceMeters?: number;
  etaMinutes?: number;
  consecutiveBreachCount: number;
  currentOtp?: string;
  failedOtpAttempts: number;
  isLocked: boolean;
  arrivedAt?: string;
  deliveredAt?: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  model: string;
  isRefrigerated: boolean;
  maxWeightCapacityKg: number;
  currentWeightKg: number;
  coolingStatus: 'Optimal' | 'Degraded' | 'Inactive';
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  status: 'On-Duty' | 'Off-Duty';
  activeRoutesCount: number;
  maxRoutesLimit: number;
}

export interface TelemetryReading {
  id: string;
  shipmentId: string;
  lat: number;
  lng: number;
  tempC: number;
  timestamp: string;
  isOutOfTolerance: boolean;
}

export interface BreachIncident {
  id: string;
  shipmentId: string;
  startTimestamp: string;
  normalizedTimestamp?: string;
  peakTemperatureC: number;
  durationSeconds?: number;
  isActive: boolean;
}

export interface LoadingManifest {
  manifestId: string;
  vehicleId: string;
  driverId: string;
  consignmentIds: string[];
  totalWeightKg: number;
  generatedAt: string;
}

export interface TelemetryGraphPoint {
  timestamp: string;
  tempC: number;
  isBreach: boolean;
}

export interface PodReceipt {
  podId: string;
  shipmentId: string;
  deliveredAt: string;
  recipientName: string;
  recipientJobTitle: string;
  signatureData: string;
  temperatureGraph: TelemetryGraphPoint[];
  breachIncidentsCount: number;
}

export interface IntakeFormData {
  itemDescription: string;
  minTempC: number;
  maxTempC: number;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  urgency: 'Standard' | 'Expedited' | 'Life-Critical';
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  recipientPhone: string;
  recipientEmail: string;
  recipientName: string;
}
