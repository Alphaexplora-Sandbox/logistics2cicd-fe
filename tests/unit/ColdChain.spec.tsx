import http from 'node:http';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { App, AppActions, AppFormState, createAppInputHandlers } from '../../src/App';
import { ColdChainManager, calculateDistanceMeters } from '../../src/services/coldChainManager';
import { generateHtml, handleRequest, startServer } from '../../src/server';
import { IntakeFormData, LoadingManifest, PodReceipt } from '../../src/types/logistics';

describe('Cold-Chain Logistics System (Features 1 - 4)', () => {
  let manager: ColdChainManager;

  beforeEach(() => {
    manager = new ColdChainManager();
  });

  // =========================================================================
  // FEATURE 1: Cold-chain consignment intake & constraint definition
  // =========================================================================
  describe('FEATURE 1: Consignment Intake & Constraints', () => {
    it('prevents registration if min_temp is greater than or equal to max_temp', () => {
      const invalidForm1: IntakeFormData = {
        itemDescription: 'Insulin Vials',
        minTempC: 8.0,
        maxTempC: 2.0, // min > max
        weightKg: 10.0,
        lengthCm: 20,
        widthCm: 20,
        heightCm: 20,
        urgency: 'Standard',
        originLat: 47.6062,
        originLng: -122.3321,
        destLat: 37.7749,
        destLng: -122.4194,
        recipientPhone: '+1-555-0100',
        recipientEmail: 'rx@test.com',
        recipientName: 'Nurse',
      };

      expect(() => manager.registerConsignment(invalidForm1)).toThrow(
        /min_temp must be strictly less than max_temp/i,
      );

      const invalidForm2: IntakeFormData = {
        ...invalidForm1,
        minTempC: 4.0,
        maxTempC: 4.0, // min == max
      };

      expect(() => manager.registerConsignment(invalidForm2)).toThrow(
        /min_temp must be strictly less than max_temp/i,
      );
    });

    it('rejects registration if required coordinates or recipient contact phone/email are missing', () => {
      const baseForm: IntakeFormData = {
        itemDescription: 'Vaccines',
        minTempC: 2.0,
        maxTempC: 8.0,
        weightKg: 5.0,
        lengthCm: 20,
        widthCm: 20,
        heightCm: 20,
        urgency: 'Standard',
        originLat: 47.6062,
        originLng: -122.3321,
        destLat: 37.7749,
        destLng: -122.4194,
        recipientPhone: '+1-555-0100',
        recipientEmail: 'rx@test.com',
        recipientName: 'Nurse',
      };

      // Missing origin coordinate
      expect(() =>
        manager.registerConsignment({ ...baseForm, originLat: null as unknown as number }),
      ).toThrow(/required coordinates are missing/i);

      // Missing destination coordinate
      expect(() =>
        manager.registerConsignment({ ...baseForm, destLng: null as unknown as number }),
      ).toThrow(/required coordinates are missing/i);

      // Missing recipient phone
      expect(() =>
        manager.registerConsignment({ ...baseForm, recipientPhone: '   ' }),
      ).toThrow(/recipient contact phone is missing/i);

      // Missing recipient email
      expect(() =>
        manager.registerConsignment({ ...baseForm, recipientEmail: '' }),
      ).toThrow(/recipient contact email is missing/i);

      // Non-positive weight
      expect(() =>
        manager.registerConsignment({ ...baseForm, weightKg: 0 }),
      ).toThrow(/weight must be greater than zero/i);
    });

    it('auto-generates an immutable tracking identifier in format TRK-XXXXX and enforces initial state as Awaiting_Assignment', () => {
      const validForm: IntakeFormData = {
        itemDescription: 'Clinical Trial Biologics',
        minTempC: -20.0,
        maxTempC: -10.0,
        weightKg: 15.5,
        lengthCm: 30,
        widthCm: 25,
        heightCm: 20,
        urgency: 'Life-Critical',
        originLat: 47.6062,
        originLng: -122.3321,
        destLat: 37.7749,
        destLng: -122.4194,
        recipientPhone: '+1-555-0199',
        recipientEmail: 'oncology@hospital.org',
        recipientName: 'Dr. Evans',
      };

      const consignment = manager.registerConsignment(validForm);

      expect(consignment.trackingNumber).toMatch(/^TRK-\d{5}$/);
      expect(consignment.status).toBe('Awaiting_Assignment');
      expect(consignment.weightKg).toBe(15.5);
      expect(consignment.urgency).toBe('Life-Critical');
    });
  });

  // =========================================================================
  // FEATURE 2: Fleet compatibility checking & dispatch allocation
  // =========================================================================
  describe('FEATURE 2: Fleet Compatibility & Dispatch', () => {
    it('blocks assignment if a temperature-sensitive shipment is assigned to a vehicle with is_refrigerated == false', () => {
      const consignment = manager.getConsignments()[0];

      // vh-dry-01 is non-refrigerated (isRefrigerated = false)
      expect(() =>
        manager.assignFleet(consignment.id, 'vh-dry-01', 'drv-01'),
      ).toThrow(/non-refrigerated vehicle/i);
    });

    it('blocks assignment if total assigned package weight exceeds vehicle max_weight_capacity_kg', () => {
      const heavyForm: IntakeFormData = {
        itemDescription: 'Heavy Lab Reagents',
        minTempC: 2.0,
        maxTempC: 8.0,
        weightKg: 100.0,
        lengthCm: 50,
        widthCm: 50,
        heightCm: 50,
        urgency: 'Standard',
        originLat: 47.6062,
        originLng: -122.3321,
        destLat: 37.7749,
        destLng: -122.4194,
        recipientPhone: '+1-555-0199',
        recipientEmail: 'lab@pharma.com',
        recipientName: 'Lab Manager',
      };
      const heavyConsignment = manager.registerConsignment(heavyForm);

      // vh-cold-heavy: MaxWeightCapacity 3000, CurrentWeight 2950 (only 50kg capacity left)
      expect(() =>
        manager.assignFleet(heavyConsignment.id, 'vh-cold-heavy', 'drv-01'),
      ).toThrow(/exceeds vehicle max weight capacity/i);
    });

    it('blocks assignment if the selected driver is marked Off-Duty or has exceeded active route limit', () => {
      const consignment = manager.getConsignments()[0];

      // drv-offduty is Off-Duty
      expect(() =>
        manager.assignFleet(consignment.id, 'vh-cold-01', 'drv-offduty'),
      ).toThrow(/marked Off-Duty/i);

      // drv-busy has 3 active routes (maxRoutesLimit: 3)
      expect(() =>
        manager.assignFleet(consignment.id, 'vh-cold-01', 'drv-busy'),
      ).toThrow(/exceeded their active route limit/i);
    });

    it('updates consignment state to Assigned and generates a consolidated vehicle loading manifest', () => {
      const consignment = manager.getConsignments()[0];

      const manifest = manager.assignFleet(consignment.id, 'vh-cold-01', 'drv-01');

      expect(manifest.manifestId).toMatch(/^MNF-\d{5}$/);
      expect(manifest.vehicleId).toBe('vh-cold-01');
      expect(manifest.driverId).toBe('drv-01');
      expect(manifest.consignmentIds).toContain(consignment.id);
      expect(consignment.status).toBe('Assigned');

      expect(manager.getManifests().length).toBeGreaterThan(0);
    });

    it('throws when consignment, vehicle, or driver is not found during assignment', () => {
      expect(() => manager.assignFleet('shp-invalid', 'vh-cold-01', 'drv-01')).toThrow(/not found/i);
      const c = manager.getConsignments()[0];
      expect(() => manager.assignFleet(c.id, 'vh-invalid', 'drv-01')).toThrow(/not found/i);
      expect(() => manager.assignFleet(c.id, 'vh-cold-01', 'drv-invalid')).toThrow(/not found/i);
    });
  });

  // =========================================================================
  // FEATURE 3: Real-time cold-chain telemetry & breach alerting
  // =========================================================================
  describe('FEATURE 3: Real-Time Telemetry & Breach Alerting', () => {
    it('accepts ingestion and triggers alert/Temperature_Breach on 2 consecutive out-of-tolerance readings', () => {
      // Consignment tolerance: [2.0°C, 8.0°C]
      const consignment = manager.getConsignments()[0];
      manager.assignFleet(consignment.id, 'vh-cold-01', 'drv-01');

      // 1st reading: in tolerance (5.0°C) -> status In_Transit
      const r1 = manager.ingestTelemetry({
        shipment_id: consignment.id,
        lat: 47.6070,
        lng: -122.3310,
        temp_c: 5.0,
      });
      expect(r1.isOutOfTolerance).toBe(false);
      expect(consignment.status).toBe('In_Transit');
      expect(consignment.etaMinutes).toBeGreaterThan(0);

      // 2nd reading: out of tolerance (10.5°C) -> 1st breach reading (still In_Transit)
      const r2 = manager.ingestTelemetry({
        shipment_id: consignment.id,
        lat: 47.6080,
        lng: -122.3300,
        temp_c: 10.5,
      });
      expect(r2.isOutOfTolerance).toBe(true);
      expect(consignment.status).toBe('In_Transit');

      // 3rd reading: 2nd CONSECUTIVE out of tolerance reading (12.2°C) -> MUST transition to Temperature_Breach!
      const r3 = manager.ingestTelemetry({
        shipment_id: consignment.id,
        lat: 47.6090,
        lng: -122.3290,
        temp_c: 12.2,
      });
      expect(r3.isOutOfTolerance).toBe(true);
      expect(consignment.status).toBe('Temperature_Breach');

      // Verify incident logged with start timestamp and peak temp
      const incidents = manager.getIncidents(consignment.id);
      expect(incidents).toHaveLength(1);
      expect(incidents[0].peakTemperatureC).toBe(12.2);
      expect(incidents[0].isActive).toBe(true);

      // 4th reading: normalized temperature (6.0°C) -> duration until normalization logged!
      manager.ingestTelemetry({
        shipment_id: consignment.id,
        lat: 47.6095,
        lng: -122.3285,
        temp_c: 6.0,
      });
      expect(consignment.status).toBe('In_Transit');
      expect(incidents[0].isActive).toBe(false);
      expect(incidents[0].durationSeconds).toBeGreaterThanOrEqual(1);

      // Telemetry history accessible
      expect(manager.getTelemetry(consignment.id)).toHaveLength(4);
      expect(manager.getIncidents().length).toBeGreaterThan(0);
    });

    it('throws when ingesting telemetry for non-existent consignment', () => {
      expect(() =>
        manager.ingestTelemetry({
          shipment_id: 'non-existent',
          lat: 47.0,
          lng: -122.0,
          temp_c: 5.0,
        }),
      ).toThrow(/not found/i);
    });
  });

  // =========================================================================
  // FEATURE 4: Geofenced delivery handoff & digital proof of delivery (POD)
  // =========================================================================
  describe('FEATURE 4: Geofenced Delivery Handoff & POD', () => {
    it('disables / blocks delivery completion when driver coordinates are >= 200m from destination', () => {
      const consignment = manager.getConsignments()[0];

      // Driver is 5km away from destination
      expect(() =>
        manager.recordArrival(consignment.id, 47.7000, -122.3300),
      ).toThrow(/within 200 meters/i);

      expect(() =>
        manager.completeDelivery(
          consignment.id,
          47.7000,
          -122.3300,
          '123456',
          'Dr. Ward',
          'Pharmacist',
          'signature',
        ),
      ).toThrow(/within 200 meters/i);
    });

    it('generates a 6-digit OTP on arrival and locks submission after 3 failed verification attempts', () => {
      // shp-sample-02 has destination (47.6101, -122.3301)
      const consignment = manager.getConsignments().find((c) => c.id === 'shp-sample-02')!;

      // Arrive within 50m of destination
      const arrived = manager.recordArrival(consignment.id, 47.6102, -122.3302);
      expect(arrived.status).toBe('Arrived_At_Destination');
      expect(arrived.currentOtp).toMatch(/^\d{6}$/);

      // Attempt 1: wrong OTP
      expect(() =>
        manager.completeDelivery(
          consignment.id,
          47.6102,
          -122.3302,
          '000000',
          'Recipient',
          'Job',
          'sig',
        ),
      ).toThrow(/2 attempt\(s\) remaining/i);

      // Attempt 2: wrong OTP
      expect(() =>
        manager.completeDelivery(
          consignment.id,
          47.6102,
          -122.3302,
          '000000',
          'Recipient',
          'Job',
          'sig',
        ),
      ).toThrow(/1 attempt\(s\) remaining/i);

      // Attempt 3: wrong OTP -> LOCKS delivery submission!
      expect(() =>
        manager.completeDelivery(
          consignment.id,
          47.6102,
          -122.3302,
          '000000',
          'Recipient',
          'Job',
          'sig',
        ),
      ).toThrow(/Delivery locked: 3 consecutive failed OTP/i);

      expect(consignment.isLocked).toBe(true);
      expect(consignment.status).toBe('Delivery_Locked');

      // Subsequent attempt fails immediately due to lock
      expect(() =>
        manager.completeDelivery(
          consignment.id,
          47.6102,
          -122.3302,
          arrived.currentOtp!,
          'Recipient',
          'Job',
          'sig',
        ),
      ).toThrow(/Delivery locked/i);

      // Arrival also fails when locked
      expect(() =>
        manager.recordArrival(consignment.id, 47.6102, -122.3302),
      ).toThrow(/locked/i);
    });

    it('requires signature, recipient name, and job title on delivery', () => {
      const consignment = manager.getConsignments().find((c) => c.id === 'shp-sample-02')!;
      const arrived = manager.recordArrival(consignment.id, 47.6102, -122.3302);

      // Missing signature
      expect(() =>
        manager.completeDelivery(
          consignment.id,
          47.6102,
          -122.3302,
          arrived.currentOtp!,
          'Name',
          'Title',
          '',
        ),
      ).toThrow(/Digital signature is required/i);

      // Missing name
      expect(() =>
        manager.completeDelivery(
          consignment.id,
          47.6102,
          -122.3302,
          arrived.currentOtp!,
          '',
          'Title',
          'sig',
        ),
      ).toThrow(/Recipient name is required/i);

      // Missing title
      expect(() =>
        manager.completeDelivery(
          consignment.id,
          47.6102,
          -122.3302,
          arrived.currentOtp!,
          'Name',
          '',
          'sig',
        ),
      ).toThrow(/Recipient job title is required/i);
    });

    it('transitions status to Delivered and generates immutable POD receipt embedding full in-transit temperature graph', () => {
      const consignment = manager.getConsignments().find((c) => c.id === 'shp-sample-02')!;

      // Ingest in-transit telemetry readings
      manager.ingestTelemetry({
        shipment_id: consignment.id,
        lat: 47.6065,
        lng: -122.3320,
        temp_c: -18.0,
      });
      manager.ingestTelemetry({
        shipment_id: consignment.id,
        lat: 47.6080,
        lng: -122.3310,
        temp_c: -16.5,
      });

      // Arrive within 200m
      const arrived = manager.recordArrival(consignment.id, 47.6102, -122.3302);
      const otp = arrived.currentOtp!;

      // Complete delivery with valid OTP and signature
      const pod = manager.completeDelivery(
        consignment.id,
        47.6102,
        -122.3302,
        otp,
        'Dr. Jennifer Hall',
        'Chief Radiopharmacist',
        'data:image/svg+xml;utf8,<svg>sig</svg>',
      );

      expect(pod.podId).toMatch(/^POD-\d{5}$/);
      expect(pod.recipientName).toBe('Dr. Jennifer Hall');
      expect(pod.recipientJobTitle).toBe('Chief Radiopharmacist');
      expect(pod.temperatureGraph).toHaveLength(2);
      expect(pod.temperatureGraph[0].tempC).toBe(-18.0);
      expect(consignment.status).toBe('Delivered');
      expect(consignment.deliveredAt).toBeDefined();

      // Retrieve POD receipt
      const retrieved = manager.getPod(consignment.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.podId).toBe(pod.podId);
    });

    it('throws when arrival or delivery is called for non-existent consignment', () => {
      expect(() => manager.recordArrival('missing-id', 47.6, -122.3)).toThrow(/not found/i);
      expect(() =>
        manager.completeDelivery('missing-id', 47.6, -122.3, '123456', 'Name', 'Title', 'sig'),
      ).toThrow(/not found/i);
    });

    it('calculateDistanceMeters returns zero for identical coordinates', () => {
      const d = calculateDistanceMeters(47.6062, -122.3321, 47.6062, -122.3321);
      expect(d).toBeCloseTo(0, 1);
    });
  });

  // =========================================================================
  // APP ACTIONS & COMPONENT RENDERING
  // =========================================================================
  describe('App Component and AppActions', () => {
    it('executes AppActions.performIntake successfully and handles validation failures', () => {
      const setSuccess = jest.fn();
      const setError = jest.fn();

      // 1. MinTemp >= MaxTemp
      AppActions.performIntake(
        {
          itemDescription: 'Test',
          minTempC: 10,
          maxTempC: 5,
          weightKg: 10,
          lengthCm: 10,
          widthCm: 10,
          heightCm: 10,
          urgency: 'Standard',
          originLat: 47.6,
          originLng: -122.3,
          destLat: 37.7,
          destLng: -122.4,
          recipientPhone: '555',
          recipientEmail: 'rx@test.com',
          recipientName: 'Nurse',
        },
        manager,
        setSuccess,
        setError,
      );
      expect(setError).toHaveBeenCalledWith(expect.stringMatching(/strictly less/i));

      // 2. Missing coordinate
      AppActions.performIntake(
        {
          itemDescription: 'Test',
          minTempC: 2,
          maxTempC: 8,
          weightKg: 10,
          lengthCm: 10,
          widthCm: 10,
          heightCm: 10,
          urgency: 'Standard',
          originLat: null as unknown as number,
          originLng: -122.3,
          destLat: 37.7,
          destLng: -122.4,
          recipientPhone: '555',
          recipientEmail: 'rx@test.com',
          recipientName: 'Nurse',
        },
        manager,
        setSuccess,
        setError,
      );
      expect(setError).toHaveBeenCalledWith(expect.stringMatching(/Required coordinates/i));

      // 3. Negative weight
      AppActions.performIntake(
        {
          itemDescription: 'Test',
          minTempC: 2,
          maxTempC: 8,
          weightKg: -5,
          lengthCm: 10,
          widthCm: 10,
          heightCm: 10,
          urgency: 'Standard',
          originLat: 47.6,
          originLng: -122.3,
          destLat: 37.7,
          destLng: -122.4,
          recipientPhone: '555',
          recipientEmail: 'rx@test.com',
          recipientName: 'Nurse',
        },
        manager,
        setSuccess,
        setError,
      );
      expect(setError).toHaveBeenCalledWith(expect.stringMatching(/greater than zero/i));

      // 4. Valid intake
      AppActions.performIntake(
        {
          itemDescription: 'Valid Vials',
          minTempC: 2,
          maxTempC: 8,
          weightKg: 10,
          lengthCm: 10,
          widthCm: 10,
          heightCm: 10,
          urgency: 'Life-Critical',
          originLat: 47.6,
          originLng: -122.3,
          destLat: 37.7,
          destLng: -122.4,
          recipientPhone: '+1-555-0100',
          recipientEmail: 'rx@hospital.org',
          recipientName: 'Nurse',
        },
        manager,
        setSuccess,
        setError,
      );
      expect(setSuccess).toHaveBeenCalledWith(expect.stringMatching(/Consignment registered successfully/i));
    });

    it('executes AppActions.performDispatch, performSendTelemetry, performRecordArrival, and performCompleteDelivery', () => {
      const setManifest = jest.fn();
      const setError = jest.fn();
      const setMessage = jest.fn();
      const setPod = jest.fn();

      const c = manager.getConsignments()[0];

      // Dispatch without consignment ID
      AppActions.performDispatch('', 'vh-cold-01', 'drv-01', manager, setManifest, setError);
      expect(setError).toHaveBeenCalledWith(expect.stringMatching(/Please select a consignment/i));

      // Dispatch error (invalid vehicle)
      AppActions.performDispatch(c.id, 'vh-invalid', 'drv-01', manager, setManifest, setError);
      expect(setError).toHaveBeenCalledWith(expect.stringMatching(/not found/i));

      // Valid dispatch
      AppActions.performDispatch(c.id, 'vh-cold-01', 'drv-01', manager, setManifest, setError);
      expect(setManifest).toHaveBeenCalledWith(expect.objectContaining({ vehicleId: 'vh-cold-01' }));

      // Telemetry error
      AppActions.performSendTelemetry('invalid-shp', 47.0, -122.0, 5.0, manager, setMessage);
      expect(setMessage).toHaveBeenCalledWith(expect.stringMatching(/not found/i));

      // Valid telemetry
      AppActions.performSendTelemetry(c.id, 47.6070, -122.3315, 5.0, manager, setMessage);
      expect(setMessage).toHaveBeenCalledWith(expect.stringMatching(/Telemetry ingested/i));

      // Breach telemetry
      AppActions.performSendTelemetry(c.id, 47.6070, -122.3315, 15.0, manager, setMessage);
      AppActions.performSendTelemetry(c.id, 47.6070, -122.3315, 16.0, manager, setMessage);
      expect(setMessage).toHaveBeenCalledWith(expect.stringMatching(/CRITICAL ALERT/i));

      // Record Arrival error
      AppActions.performRecordArrival('invalid-shp', 47.0, -122.0, manager, setMessage);
      expect(setMessage).toHaveBeenCalledWith(expect.stringMatching(/not found/i));

      // Valid Arrival (< 200m)
      const c2 = manager.getConsignments().find((item) => item.id === 'shp-sample-02')!;
      AppActions.performRecordArrival(c2.id, 47.6102, -122.3302, manager, setMessage);
      expect(setMessage).toHaveBeenCalledWith(expect.stringMatching(/Driver arrived/i));

      // Complete Delivery error
      AppActions.performCompleteDelivery('invalid-shp', 47.0, -122.0, '123', 'a', 'b', 'c', manager, setPod, setError);
      expect(setError).toHaveBeenCalledWith(expect.stringMatching(/not found/i));

      // Complete Delivery valid
      AppActions.performCompleteDelivery(
        c2.id,
        47.6102,
        -122.3302,
        c2.currentOtp!,
        'Pharmacist Jane',
        'Head Pharmacist',
        'sig',
        manager,
        setPod,
        setError,
      );
      expect(setPod).toHaveBeenCalledWith(expect.objectContaining({ recipientName: 'Pharmacist Jane' }));
    });

    it('exercises createAppInputHandlers completely', () => {
      const formState: AppFormState = {
        intakeForm: {
          itemDescription: 'desc',
          minTempC: 2,
          maxTempC: 8,
          weightKg: 10,
          lengthCm: 20,
          widthCm: 20,
          heightCm: 20,
          urgency: 'Standard',
          originLat: 47,
          originLng: -122,
          destLat: 37,
          destLng: -122,
          recipientPhone: '123',
          recipientEmail: 'a@b.com',
          recipientName: 'name',
        },
        setIntakeForm: jest.fn((updater: unknown) => {
          if (typeof updater === 'function') {
            (updater as (prev: IntakeFormData) => IntakeFormData)(formState.intakeForm);
          }
        }),
        selectedConsignmentId: 'shp-sample-01',
        setSelectedConsignmentId: jest.fn(),
        selectedVehicleId: 'vh-cold-01',
        setSelectedVehicleId: jest.fn(),
        selectedDriverId: 'drv-01',
        setSelectedDriverId: jest.fn(),
        priorityFilter: 'ALL',
        setPriorityFilter: jest.fn(),
        telemetryShipmentId: 'shp-sample-01',
        setTelemetryShipmentId: jest.fn(),
        telemetryLat: 47.6,
        setTelemetryLat: jest.fn(),
        telemetryLng: -122.3,
        setTelemetryLng: jest.fn(),
        telemetryTemp: 4.5,
        setTelemetryTemp: jest.fn(),
        deliveryShipmentId: 'shp-sample-01',
        setDeliveryShipmentId: jest.fn(),
        driverGpsLat: 37.7,
        setDriverGpsLat: jest.fn(),
        driverGpsLng: -122.4,
        setDriverGpsLng: jest.fn(),
        enteredOtp: '123456',
        setEnteredOtp: jest.fn(),
        recipientName: 'rec',
        setRecipientName: jest.fn(),
        recipientJobTitle: 'job',
        setRecipientJobTitle: jest.fn(),
        signatureData: 'sig',
        setSignatureData: jest.fn(),
      };

      const setters = {
        setIntakeSuccess: jest.fn(),
        setIntakeError: jest.fn(),
        setActiveManifest: jest.fn(),
        setDispatchError: jest.fn(),
        setTelemetryMessage: jest.fn(),
        setDeliveryError: jest.fn(),
        setPodReceipt: jest.fn(),
      };

      const handlers = createAppInputHandlers(formState, manager, setters);

      // Test event-based handlers
      const mockInputEvent = (val: string) =>
        ({ target: { value: val } }) as unknown as React.ChangeEvent<HTMLInputElement>;
      const mockSelectEvent = (val: string) =>
        ({ target: { value: val } }) as unknown as React.ChangeEvent<HTMLSelectElement>;

      handlers.onTabIntake();
      handlers.onTabDispatch();
      handlers.onTabTelemetry();
      handlers.onTabDelivery();
      handlers.onDescriptionChange(mockInputEvent('vaccine'));
      handlers.onMinTempChange(mockInputEvent('2.5'));
      handlers.onMaxTempChange(mockInputEvent('8.5'));
      handlers.onWeightChange(mockInputEvent('12.0'));
      handlers.onUrgencyChange(mockSelectEvent('Life-Critical'));
      handlers.onPhoneChange(mockInputEvent('555-1234'));
      handlers.onEmailChange(mockInputEvent('rx@hospital.com'));
      handlers.onPriorityFilterChange(mockSelectEvent('Life-Critical'));
      handlers.onConsignmentSelectChange(mockSelectEvent('shp-1'));
      handlers.onVehicleSelectChange(mockSelectEvent('vh-cold-01'));
      handlers.onDriverSelectChange(mockSelectEvent('drv-01'));
      handlers.onTelemetryShipmentChange(mockSelectEvent('shp-1'));
      handlers.onTelemetryTempChange(mockInputEvent('5.0'));
      handlers.onTelemetryLatChange(mockInputEvent('47.6'));
      handlers.onTelemetryLngChange(mockInputEvent('-122.3'));
      handlers.onDeliveryShipmentChange(mockSelectEvent('shp-1'));
      handlers.onDriverLatChange(mockInputEvent('37.77'));
      handlers.onDriverLngChange(mockInputEvent('-122.41'));
      handlers.onOtpChange(mockInputEvent('123456'));
      handlers.onRecipientNameChange(mockInputEvent('Nurse'));
      handlers.onRecipientTitleChange(mockInputEvent('RN'));
      handlers.onSignatureChange(mockInputEvent('svg-sig'));

      expect(formState.setIntakeForm).toHaveBeenCalled();
      expect(formState.setSelectedConsignmentId).toHaveBeenCalledWith('shp-1');
      expect(formState.setPriorityFilter).toHaveBeenCalledWith('Life-Critical');

      handlers.submitIntake({ preventDefault: jest.fn() });
      handlers.submitDispatch();
      handlers.submitTelemetry();
      handlers.submitArrival();
      handlers.submitCompleteDelivery();
    });

    it('renders all tabs and states of the App component', () => {
      // 1. Intake tab with success
      const htmlIntake = renderToString(
        <App initialTab="intake" initialSuccess="Consignment registered" initialError="Sample error" />,
      );
      expect(htmlIntake).toContain('Feature 1: Cold-Chain Consignment Intake');
      expect(htmlIntake).toContain('Consignment registered');
      expect(htmlIntake).toContain('Sample error');

      // 2. Dispatch tab with manifest
      const mockManifest: LoadingManifest = {
        manifestId: 'MNF-99999',
        vehicleId: 'vh-cold-01',
        driverId: 'drv-01',
        consignmentIds: ['shp-1'],
        totalWeightKg: 45,
        generatedAt: '2026-10-02T12:00:00Z',
      };
      const htmlDispatch = renderToString(
        <App initialTab="dispatch" initialManifest={mockManifest} initialError="Overloaded vehicle error" />,
      );
      expect(htmlDispatch).toContain('Feature 2: Fleet Compatibility');
      expect(htmlDispatch).toContain('MNF-99999');
      expect(htmlDispatch).toContain('Overloaded vehicle error');

      // 3. Telemetry tab with normal status and with incidents
      const htmlTelemetry = renderToString(
        <App initialTab="telemetry" initialError="CRITICAL ALERT: Breach" />,
      );
      expect(htmlTelemetry).toContain('Feature 3: Real-Time Telemetry');
      expect(htmlTelemetry).toContain('CRITICAL ALERT');

      const managerWithIncident = new ColdChainManager();
      // Normalized incident (durationSeconds is set)
      managerWithIncident.ingestTelemetry({ shipment_id: 'shp-sample-01', lat: 47.6, lng: -122.3, temp_c: 15.0 });
      managerWithIncident.ingestTelemetry({ shipment_id: 'shp-sample-01', lat: 47.6, lng: -122.3, temp_c: 15.0 });
      managerWithIncident.ingestTelemetry({ shipment_id: 'shp-sample-01', lat: 47.6, lng: -122.3, temp_c: 4.0 });
      // Active incident (in progress, durationSeconds is undefined)
      managerWithIncident.ingestTelemetry({ shipment_id: 'shp-sample-02', lat: 47.6, lng: -122.3, temp_c: 15.0 });
      managerWithIncident.ingestTelemetry({ shipment_id: 'shp-sample-02', lat: 47.6, lng: -122.3, temp_c: 15.0 });

      const htmlTelemetryIncidents = renderToString(
        <App initialTab="telemetry" initialError="Telemetry recorded successfully" managerInstance={managerWithIncident} />,
      );
      expect(htmlTelemetryIncidents).toContain('NORMALIZED');
      expect(htmlTelemetryIncidents).toContain('ACTIVE');

      // 4. Delivery tab with POD receipt, locked state, and standard error
      const mockPod: PodReceipt = {
        podId: 'POD-88888',
        shipmentId: 'shp-sample-01',
        deliveredAt: '2026-10-02T12:30:00Z',
        recipientName: 'Dr. Evans',
        recipientJobTitle: 'Clinical Lead',
        signatureData: '<svg>signature</svg>',
        temperatureGraph: [{ timestamp: '2026-10-02T12:15:00Z', tempC: 4.5, isBreach: false }],
        breachIncidentsCount: 0,
      };
      const htmlDelivery = renderToString(
        <App initialTab="delivery" initialPod={mockPod} initialError="Standard geofence notice" />,
      );
      expect(htmlDelivery).toContain('Feature 4: Geofenced Delivery Handoff');
      expect(htmlDelivery).toContain('POD-88888');
      expect(htmlDelivery).toContain('Standard geofence notice');

      const managerLocked = new ColdChainManager();
      managerLocked.recordArrival('shp-sample-01', 37.7749, -122.4194);
      try { managerLocked.completeDelivery('shp-sample-01', 37.7749, -122.4194, '000000', 'Doc', 'MD', 'sig'); } catch { /* ignore */ }
      try { managerLocked.completeDelivery('shp-sample-01', 37.7749, -122.4194, '000000', 'Doc', 'MD', 'sig'); } catch { /* ignore */ }
      try { managerLocked.completeDelivery('shp-sample-01', 37.7749, -122.4194, '000000', 'Doc', 'MD', 'sig'); } catch { /* ignore */ }
      const htmlDeliveryLocked = renderToString(
        <App initialTab="delivery" initialError="Account locked after 3 failures" managerInstance={managerLocked} />,
      );
      expect(htmlDeliveryLocked).toContain('locked');

      const htmlDeliveryOutsideGeofence = renderToString(
        <App initialTab="delivery" initialDriverLat={0} initialDriverLng={0} />,
      );
      expect(htmlDeliveryOutsideGeofence).toContain('Outside Geofence');
    });

    it('AppActions handles all operations and errors properly', () => {
      const setSuccess = jest.fn();
      const setError = jest.fn();
      const setManifest = jest.fn();
      const setMsg = jest.fn();
      const setPod = jest.fn();

      // Intake with missing coordinates
      AppActions.performIntake({
        itemDescription: '',
        minTempC: 2,
        maxTempC: 8,
        weightKg: 10,
        lengthCm: 10,
        widthCm: 10,
        heightCm: 10,
        urgency: 'Standard',
        originLat: 0,
        originLng: 0,
        destLat: 0,
        destLng: 0,
        recipientPhone: '',
        recipientEmail: '',
        recipientName: '',
      }, manager, setSuccess, setError);
      expect(setError).toHaveBeenCalledWith(expect.stringContaining('Prevented submission'));

      // Intake with minTemp >= maxTemp
      AppActions.performIntake({
        itemDescription: 'Test',
        minTempC: 10,
        maxTempC: 5,
        weightKg: 10,
        lengthCm: 10,
        widthCm: 10,
        heightCm: 10,
        urgency: 'Standard',
        originLat: 47.6,
        originLng: -122.3,
        destLat: 37.7,
        destLng: -122.4,
        recipientPhone: '555',
        recipientEmail: 'a@b.com',
        recipientName: 'Nurse',
      }, manager, setSuccess, setError);
      expect(setError).toHaveBeenCalled();

      // Dispatch without consignmentId
      AppActions.performDispatch('', 'vh-cold-01', 'drv-01', manager, setManifest, setError);
      expect(setError).toHaveBeenCalledWith('Please select a consignment to assign.');

      // Dispatch error (non-refrigerated)
      AppActions.performDispatch('shp-sample-01', 'vh-dry-01', 'drv-01', manager, setManifest, setError);
      expect(setError).toHaveBeenCalled();

      // Telemetry error (unknown shipment)
      AppActions.performSendTelemetry('unknown-shp', 47.6, -122.3, 4.0, manager, setMsg);
      expect(setMsg).toHaveBeenCalled();

      // Telemetry success (normal temp)
      AppActions.performSendTelemetry('shp-sample-01', 47.6, -122.3, 4.0, manager, setMsg);
      expect(setMsg).toHaveBeenCalledWith(expect.stringContaining('Telemetry ingested'));

      // Arrival error
      AppActions.performRecordArrival('unknown-shp', 37.7, -122.4, manager, setMsg);
      expect(setMsg).toHaveBeenCalled();

      // Arrival success
      AppActions.performRecordArrival('shp-sample-01', 37.7749, -122.4194, manager, setMsg);
      expect(setMsg).toHaveBeenCalledWith(expect.stringContaining('OTP Generated'));

      // Complete delivery error
      AppActions.performCompleteDelivery('shp-sample-01', 37.7749, -122.4194, 'wrong', 'Doc', 'Title', 'sig', manager, setPod, setError);
      expect(setError).toHaveBeenCalled();

      // Complete delivery success
      const consignment = manager.getConsignments().find((c) => c.id === 'shp-sample-01');
      if (consignment && consignment.currentOtp) {
        AppActions.performCompleteDelivery('shp-sample-01', 37.7749, -122.4194, consignment.currentOtp, 'Doc', 'Title', 'sig', manager, setPod, setError);
        expect(setPod).toHaveBeenCalled();
      }
    });

    it('server generates valid HTML and handles requests', async () => {
      const html = generateHtml();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('logistics2cicd-frontend');

      // Test startServer and listen callback
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const server = startServer(3948);
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      await new Promise<void>((resolve) => server.close(() => resolve()));
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();

      // Test root HTML page
      const reqRoot = {
        url: '/',
        headers: { host: 'localhost:3000' },
      } as http.IncomingMessage;

      const resRoot = {
        writeHead: jest.fn(),
        end: jest.fn(),
      } as unknown as http.ServerResponse;

      handleRequest(reqRoot, resRoot);
      expect(resRoot.writeHead).toHaveBeenCalledWith(200, expect.anything());
      expect(resRoot.end).toHaveBeenCalledWith(expect.stringContaining('<!DOCTYPE html>'));

      // Test fallback url and host
      const reqFallback = {
        url: undefined,
        headers: {},
      } as unknown as http.IncomingMessage;
      handleRequest(reqFallback, resRoot);

      // Test /health
      const reqHealth = {
        url: '/health',
        headers: { host: 'localhost:3000' },
      } as http.IncomingMessage;
      const resHealth = {
        writeHead: jest.fn(),
        end: jest.fn(),
      } as unknown as http.ServerResponse;
      handleRequest(reqHealth, resHealth);
      expect(resHealth.writeHead).toHaveBeenCalledWith(200, expect.anything());

      // Test /api/health
      const reqApiHealth = {
        url: '/api/health',
        headers: { host: 'localhost:3000' },
      } as http.IncomingMessage;

      let apiResponse = '';
      const resApi = {
        writeHead: jest.fn(),
        end: (body: string) => {
          apiResponse = body;
        },
      } as unknown as http.ServerResponse;

      handleRequest(reqApiHealth, resApi);
      const parsed = JSON.parse(apiResponse);
      expect(parsed.status).toBe('ok');
    });
  });
});
