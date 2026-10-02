import {
  BreachIncident,
  Consignment,
  Driver,
  IntakeFormData,
  LoadingManifest,
  PodReceipt,
  TelemetryReading,
  Vehicle,
} from '../types/logistics';
import {
  INITIAL_CONSIGNMENTS,
  INITIAL_DRIVERS,
  INITIAL_VEHICLES,
} from '../data/mockData';

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class ColdChainManager {
  private consignments: Consignment[] = [];
  private vehicles: Vehicle[] = [];
  private drivers: Driver[] = [];
  private telemetryMap: Map<string, TelemetryReading[]> = new Map();
  private incidents: BreachIncident[] = [];
  private manifests: LoadingManifest[] = [];
  private podReceipts: Map<string, PodReceipt> = new Map();

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.consignments = JSON.parse(JSON.stringify(INITIAL_CONSIGNMENTS));
    this.vehicles = JSON.parse(JSON.stringify(INITIAL_VEHICLES));
    this.drivers = JSON.parse(JSON.stringify(INITIAL_DRIVERS));
    this.telemetryMap.clear();
    this.incidents = [];
    this.manifests = [];
    this.podReceipts.clear();
  }

  // FEATURE 1: Cold-chain consignment intake & constraint definition
  public registerConsignment(form: IntakeFormData): Consignment {
    // 1. Prevent form submission if min_temp is greater than or equal to max_temp
    if (form.minTempC >= form.maxTempC) {
      throw new Error(
        'Validation failed: min_temp must be strictly less than max_temp.',
      );
    }

    // 3. Reject registration if required coordinates or recipient contact phone/email are missing
    if (
      form.originLat === undefined ||
      form.originLat === null ||
      isNaN(form.originLat) ||
      form.originLng === undefined ||
      form.originLng === null ||
      isNaN(form.originLng) ||
      form.destLat === undefined ||
      form.destLat === null ||
      isNaN(form.destLat) ||
      form.destLng === undefined ||
      form.destLng === null ||
      isNaN(form.destLng)
    ) {
      throw new Error('Validation failed: Required coordinates are missing.');
    }

    if (!form.recipientPhone || form.recipientPhone.trim() === '') {
      throw new Error('Validation failed: Recipient contact phone is missing.');
    }

    if (!form.recipientEmail || form.recipientEmail.trim() === '') {
      throw new Error('Validation failed: Recipient contact email is missing.');
    }

    if (form.weightKg <= 0) {
      throw new Error('Validation failed: Package weight must be greater than zero.');
    }

    // 2. Auto-generate an immutable tracking identifier in the format TRK-XXXXX
    const randomCode = Math.floor(10000 + Math.random() * 90000);
    const trackingNumber = `TRK-${randomCode}`;
    const id = `shp-${Date.now()}-${randomCode}`;

    // 4. Enforce initial state as Awaiting_Assignment
    const consignment: Consignment = {
      id,
      trackingNumber,
      itemDescription: form.itemDescription || 'Cold-chain Consignment',
      minTempC: form.minTempC,
      maxTempC: form.maxTempC,
      weightKg: form.weightKg,
      lengthCm: form.lengthCm,
      widthCm: form.widthCm,
      heightCm: form.heightCm,
      urgency: form.urgency || 'Standard',
      originLat: form.originLat,
      originLng: form.originLng,
      destLat: form.destLat,
      destLng: form.destLng,
      recipientPhone: form.recipientPhone.trim(),
      recipientEmail: form.recipientEmail.trim(),
      recipientName: form.recipientName || '',
      status: 'Awaiting_Assignment',
      createdAt: new Date().toISOString(),
      consecutiveBreachCount: 0,
      failedOtpAttempts: 0,
      isLocked: false,
    };

    this.consignments.unshift(consignment);
    return consignment;
  }

  // FEATURE 2: Fleet compatibility checking & dispatch allocation
  public assignFleet(
    consignmentId: string,
    vehicleId: string,
    driverId: string,
  ): LoadingManifest {
    const consignment = this.consignments.find((c) => c.id === consignmentId);
    if (!consignment) {
      throw new Error(`Consignment ${consignmentId} not found.`);
    }

    const vehicle = this.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found.`);
    }

    const driver = this.drivers.find((d) => d.id === driverId);
    if (!driver) {
      throw new Error(`Driver ${driverId} not found.`);
    }

    // 1. Block assignment if a temperature-sensitive shipment is assigned to a vehicle with is_refrigerated == false
    if (!vehicle.isRefrigerated) {
      throw new Error(
        'Assignment blocked: Temperature-sensitive shipment cannot be assigned to a non-refrigerated vehicle.',
      );
    }

    // 2. Block assignment if total assigned package weight exceeds the vehicle's max_weight_capacity_kg
    if (vehicle.currentWeightKg + consignment.weightKg > vehicle.maxWeightCapacityKg) {
      throw new Error(
        `Assignment blocked: Total package weight (${(vehicle.currentWeightKg + consignment.weightKg).toFixed(1)}kg) exceeds vehicle max weight capacity (${vehicle.maxWeightCapacityKg}kg).`,
      );
    }

    // 3. Block assignment if the selected driver is marked Off-Duty or has exceeded their active route limit
    if (driver.status === 'Off-Duty') {
      throw new Error('Assignment blocked: Selected driver is marked Off-Duty.');
    }

    if (driver.activeRoutesCount >= driver.maxRoutesLimit) {
      throw new Error(
        `Assignment blocked: Driver has exceeded their active route limit (${driver.maxRoutesLimit}).`,
      );
    }

    // 4. Update consignment state to Assigned and generate a consolidated vehicle loading manifest
    consignment.status = 'Assigned';
    consignment.assignedVehicleId = vehicle.id;
    consignment.assignedDriverId = driver.id;

    vehicle.currentWeightKg += consignment.weightKg;
    driver.activeRoutesCount += 1;

    const manifestCode = Math.floor(10000 + Math.random() * 90000);
    const manifest: LoadingManifest = {
      manifestId: `MNF-${manifestCode}`,
      vehicleId: vehicle.id,
      driverId: driver.id,
      consignmentIds: [consignment.id],
      totalWeightKg: consignment.weightKg,
      generatedAt: new Date().toISOString(),
    };

    this.manifests.unshift(manifest);
    return manifest;
  }

  // FEATURE 3: Real-time cold-chain telemetry & breach alerting
  public ingestTelemetry(payload: {
    shipment_id: string;
    lat: number;
    lng: number;
    temp_c: number;
    timestamp?: string;
  }): TelemetryReading {
    const consignment = this.consignments.find(
      (c) => c.id === payload.shipment_id,
    );
    if (!consignment) {
      throw new Error(`Consignment ${payload.shipment_id} not found.`);
    }

    const timestamp = payload.timestamp || new Date().toISOString();
    const isOutOfTolerance =
      payload.temp_c < consignment.minTempC ||
      payload.temp_c > consignment.maxTempC;

    const reading: TelemetryReading = {
      id: `tel-${Date.now()}-${Math.random()}`,
      shipmentId: consignment.id,
      lat: payload.lat,
      lng: payload.lng,
      tempC: payload.temp_c,
      timestamp,
      isOutOfTolerance,
    };

    const history = this.telemetryMap.get(consignment.id) || [];
    history.push(reading);
    this.telemetryMap.set(consignment.id, history);

    consignment.currentLat = payload.lat;
    consignment.currentLng = payload.lng;
    consignment.currentTempC = payload.temp_c;

    if (consignment.status === 'Assigned') {
      consignment.status = 'In_Transit';
    }

    // 4. Dynamically update remaining transit ETA based on latest coordinates and route progress
    if (consignment.destLat && consignment.destLng) {
      const remainingMeters = calculateDistanceMeters(
        payload.lat,
        payload.lng,
        consignment.destLat,
        consignment.destLng,
      );
      consignment.remainingDistanceMeters = remainingMeters;
      // 50 km/h avg speed = 833.33 meters/min
      consignment.etaMinutes = Math.max(1, Math.ceil(remainingMeters / 833.33));
    }

    // 2. Trigger an alert and set state to Temperature_Breach when temperature stays out of tolerance for 2 consecutive readings
    if (isOutOfTolerance) {
      consignment.consecutiveBreachCount += 1;

      if (consignment.consecutiveBreachCount >= 2) {
        consignment.status = 'Temperature_Breach';

        // 3. Log breach incidents with start timestamp, peak temperature, and duration until normalization
        const activeIncident = this.incidents.find(
          (i) => i.shipmentId === consignment.id && i.isActive,
        );
        if (!activeIncident) {
          const newIncident: BreachIncident = {
            id: `INC-${Math.floor(10000 + Math.random() * 90000)}`,
            shipmentId: consignment.id,
            startTimestamp: timestamp,
            peakTemperatureC: payload.temp_c,
            isActive: true,
          };
          this.incidents.unshift(newIncident);
        } else {
          activeIncident.peakTemperatureC = Math.max(
            activeIncident.peakTemperatureC,
            payload.temp_c,
          );
        }
      }
    } else {
      // Temperature normalized
      consignment.consecutiveBreachCount = 0;

      const activeIncident = this.incidents.find(
        (i) => i.shipmentId === consignment.id && i.isActive,
      );
      if (activeIncident) {
        activeIncident.normalizedTimestamp = timestamp;
        const startMs = new Date(activeIncident.startTimestamp).getTime();
        const normMs = new Date(timestamp).getTime();
        activeIncident.durationSeconds = Math.max(
          1,
          Math.round((normMs - startMs) / 1000),
        );
        activeIncident.isActive = false;
      }

      if (consignment.status === 'Temperature_Breach') {
        consignment.status = 'In_Transit';
      }
    }

    return reading;
  }

  // FEATURE 4: Geofenced delivery handoff & digital proof of delivery (POD)
  public recordArrival(
    consignmentId: string,
    driverLat: number,
    driverLng: number,
  ): Consignment {
    const consignment = this.consignments.find((c) => c.id === consignmentId);
    if (!consignment) {
      throw new Error(`Consignment ${consignmentId} not found.`);
    }

    if (consignment.isLocked) {
      throw new Error('Delivery submission is locked.');
    }

    // 1. Disable the "Complete Delivery" action until driver coordinates are < 200m from destination coordinates
    const distanceMeters = calculateDistanceMeters(
      driverLat,
      driverLng,
      consignment.destLat,
      consignment.destLng,
    );

    consignment.remainingDistanceMeters = distanceMeters;

    if (distanceMeters >= 200.0) {
      throw new Error(
        `Geofence restriction: Driver is ${distanceMeters.toFixed(1)}m away. Must be within 200 meters of destination.`,
      );
    }

    // 2. Generate a 6-digit OTP on arrival
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    consignment.currentOtp = otp;
    consignment.failedOtpAttempts = 0;
    consignment.status = 'Arrived_At_Destination';
    consignment.arrivedAt = new Date().toISOString();

    return consignment;
  }

  public completeDelivery(
    consignmentId: string,
    driverLat: number,
    driverLng: number,
    otpCode: string,
    recipientName: string,
    recipientJobTitle: string,
    signatureData: string,
  ): PodReceipt {
    const consignment = this.consignments.find((c) => c.id === consignmentId);
    if (!consignment) {
      throw new Error(`Consignment ${consignmentId} not found.`);
    }

    if (consignment.isLocked) {
      throw new Error(
        'Delivery locked: 3 consecutive failed OTP verification attempts.',
      );
    }

    // 1. Check geofence (< 200m)
    const distanceMeters = calculateDistanceMeters(
      driverLat,
      driverLng,
      consignment.destLat,
      consignment.destLng,
    );

    if (distanceMeters >= 200.0) {
      throw new Error(
        `Geofence constraint: Driver is ${distanceMeters.toFixed(1)}m away. Must be within 200 meters of destination coordinates.`,
      );
    }

    // 2. Verify 6-digit OTP; lock submission after 3 failed verification attempts
    if (!consignment.currentOtp || consignment.currentOtp !== otpCode.trim()) {
      consignment.failedOtpAttempts += 1;
      if (consignment.failedOtpAttempts >= 3) {
        consignment.isLocked = true;
        consignment.status = 'Delivery_Locked';
        throw new Error(
          'Delivery locked: 3 consecutive failed OTP verification attempts.',
        );
      }
      throw new Error(
        `Invalid OTP code. ${3 - consignment.failedOtpAttempts} attempt(s) remaining.`,
      );
    }

    // 3. Capture digital signature as vector path or base64 image along with recipient name and job title
    if (!signatureData || signatureData.trim() === '') {
      throw new Error('Digital signature is required.');
    }

    if (!recipientName || recipientName.trim() === '') {
      throw new Error('Recipient name is required.');
    }

    if (!recipientJobTitle || recipientJobTitle.trim() === '') {
      throw new Error('Recipient job title is required.');
    }

    // 4. Transition status to Delivered and generate an immutable POD receipt embedding full in-transit temperature graph
    consignment.status = 'Delivered';
    consignment.deliveredAt = new Date().toISOString();
    consignment.recipientName = recipientName.trim();

    const history = this.telemetryMap.get(consignment.id) || [];
    const temperatureGraph = history.map((h) => ({
      timestamp: h.timestamp,
      tempC: h.tempC,
      isBreach: h.isOutOfTolerance,
    }));

    const breachCount = this.incidents.filter(
      (i) => i.shipmentId === consignment.id,
    ).length;

    const podCode = Math.floor(10000 + Math.random() * 90000);
    const receipt: PodReceipt = {
      podId: `POD-${podCode}`,
      shipmentId: consignment.id,
      deliveredAt: consignment.deliveredAt,
      recipientName: recipientName.trim(),
      recipientJobTitle: recipientJobTitle.trim(),
      signatureData,
      temperatureGraph,
      breachIncidentsCount: breachCount,
    };

    this.podReceipts.set(consignment.id, receipt);
    return receipt;
  }

  // Getters
  public getConsignments(): Consignment[] {
    return this.consignments;
  }

  public getVehicles(): Vehicle[] {
    return this.vehicles;
  }

  public getDrivers(): Driver[] {
    return this.drivers;
  }

  public getTelemetry(shipmentId: string): TelemetryReading[] {
    return this.telemetryMap.get(shipmentId) || [];
  }

  public getIncidents(shipmentId?: string): BreachIncident[] {
    if (shipmentId) {
      return this.incidents.filter((i) => i.shipmentId === shipmentId);
    }
    return this.incidents;
  }

  public getManifests(): LoadingManifest[] {
    return this.manifests;
  }

  public getPod(shipmentId: string): PodReceipt | undefined {
    return this.podReceipts.get(shipmentId);
  }
}
