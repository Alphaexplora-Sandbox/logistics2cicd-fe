import React, { useState } from 'react';
import { ColdChainManager, calculateDistanceMeters } from './services/coldChainManager';
import { IntakeFormData, LoadingManifest, PodReceipt } from './types/logistics';

export interface AppProps {
  title?: string;
  initialTab?: 'intake' | 'dispatch' | 'telemetry' | 'delivery';
  managerInstance?: ColdChainManager;
  initialManifest?: LoadingManifest | null;
  initialPod?: PodReceipt | null;
  initialError?: string | null;
  initialSuccess?: string | null;
}

export const AppActions = {
  performIntake: (
    form: IntakeFormData,
    manager: ColdChainManager,
    setSuccess: (msg: string | null) => void,
    setError: (msg: string | null) => void,
  ) => {
    setError(null);
    setSuccess(null);

    // Feature 1 Acceptance Criteria 1: Prevent form submission if min_temp >= max_temp
    if (form.minTempC >= form.maxTempC) {
      setError('Prevented submission: min_temp must be strictly less than max_temp.');
      return;
    }

    // Feature 1 Acceptance Criteria 3: Reject registration if required coordinates or recipient phone/email missing
    if (
      !form.originLat ||
      !form.originLng ||
      !form.destLat ||
      !form.destLng ||
      !form.recipientPhone?.trim() ||
      !form.recipientEmail?.trim()
    ) {
      setError('Prevented submission: Required coordinates and recipient contact phone/email must be provided.');
      return;
    }

    try {
      const created = manager.registerConsignment(form);
      setSuccess(`Consignment registered successfully! Generated Tracking ID: ${created.trackingNumber} [Initial State: ${created.status}]`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  },

  performDispatch: (
    consignmentId: string,
    vehicleId: string,
    driverId: string,
    manager: ColdChainManager,
    setManifest: (m: LoadingManifest | null) => void,
    setError: (msg: string | null) => void,
  ) => {
    setError(null);
    setManifest(null);

    if (!consignmentId) {
      setError('Please select a consignment to assign.');
      return;
    }

    try {
      const manifest = manager.assignFleet(consignmentId, vehicleId, driverId);
      setManifest(manifest);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  },

  performSendTelemetry: (
    shipmentId: string,
    lat: number,
    lng: number,
    temp: number,
    manager: ColdChainManager,
    setMessage: (msg: string | null) => void,
  ) => {
    setMessage(null);
    try {
      const reading = manager.ingestTelemetry({
        shipment_id: shipmentId,
        lat,
        lng,
        temp_c: temp,
      });

      const updated = manager.getConsignments().find((c) => c.id === shipmentId);
      if (updated?.status === 'Temperature_Breach') {
        setMessage(`CRITICAL ALERT: 2 consecutive readings out of tolerance! State set to Temperature_Breach. Current Temp: ${reading.tempC}°C.`);
      } else {
        setMessage(`Telemetry ingested. Temp: ${reading.tempC}°C. Remaining ETA: ${updated?.etaMinutes ?? 'N/A'} mins.`);
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  },

  performRecordArrival: (
    shipmentId: string,
    lat: number,
    lng: number,
    manager: ColdChainManager,
    setMessage: (msg: string | null) => void,
  ) => {
    setMessage(null);
    try {
      const updated = manager.recordArrival(shipmentId, lat, lng);
      setMessage(`Driver arrived. 6-Digit OTP Generated: ${updated.currentOtp}`);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  },

  performCompleteDelivery: (
    shipmentId: string,
    lat: number,
    lng: number,
    otp: string,
    recipientName: string,
    recipientJobTitle: string,
    signatureData: string,
    manager: ColdChainManager,
    setPod: (pod: PodReceipt | null) => void,
    setError: (msg: string | null) => void,
  ) => {
    setError(null);
    setPod(null);

    try {
      const pod = manager.completeDelivery(
        shipmentId,
        lat,
        lng,
        otp,
        recipientName,
        recipientJobTitle,
        signatureData,
      );
      setPod(pod);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  },
};

export interface AppFormState {
  intakeForm: IntakeFormData;
  setIntakeForm: React.Dispatch<React.SetStateAction<IntakeFormData>>;
  selectedConsignmentId: string;
  setSelectedConsignmentId: React.Dispatch<React.SetStateAction<string>>;
  selectedVehicleId: string;
  setSelectedVehicleId: React.Dispatch<React.SetStateAction<string>>;
  selectedDriverId: string;
  setSelectedDriverId: React.Dispatch<React.SetStateAction<string>>;
  priorityFilter: string;
  setPriorityFilter: React.Dispatch<React.SetStateAction<string>>;
  telemetryShipmentId: string;
  setTelemetryShipmentId: React.Dispatch<React.SetStateAction<string>>;
  telemetryLat: number;
  setTelemetryLat: React.Dispatch<React.SetStateAction<number>>;
  telemetryLng: number;
  setTelemetryLng: React.Dispatch<React.SetStateAction<number>>;
  telemetryTemp: number;
  setTelemetryTemp: React.Dispatch<React.SetStateAction<number>>;
  deliveryShipmentId: string;
  setDeliveryShipmentId: React.Dispatch<React.SetStateAction<string>>;
  driverGpsLat: number;
  setDriverGpsLat: React.Dispatch<React.SetStateAction<number>>;
  driverGpsLng: number;
  setDriverGpsLng: React.Dispatch<React.SetStateAction<number>>;
  enteredOtp: string;
  setEnteredOtp: React.Dispatch<React.SetStateAction<string>>;
  recipientName: string;
  setRecipientName: React.Dispatch<React.SetStateAction<string>>;
  recipientJobTitle: string;
  setRecipientJobTitle: React.Dispatch<React.SetStateAction<string>>;
  signatureData: string;
  setSignatureData: React.Dispatch<React.SetStateAction<string>>;
}

export const createAppInputHandlers = (
  state: AppFormState,
  manager: ColdChainManager,
  setters: {
    setIntakeSuccess: (msg: string | null) => void;
    setIntakeError: (msg: string | null) => void;
    setActiveManifest: (m: LoadingManifest | null) => void;
    setDispatchError: (msg: string | null) => void;
    setTelemetryMessage: (msg: string | null) => void;
    setDeliveryError: (msg: string | null) => void;
    setPodReceipt: (pod: PodReceipt | null) => void;
    setActiveTab?: (tab: 'intake' | 'dispatch' | 'telemetry' | 'delivery') => void;
  },
) => ({
  handleDescriptionChange: (val: string) => state.setIntakeForm((f) => ({ ...f, itemDescription: val })),
  handleMinTempChange: (val: number) => state.setIntakeForm((f) => ({ ...f, minTempC: val })),
  handleMaxTempChange: (val: number) => state.setIntakeForm((f) => ({ ...f, maxTempC: val })),
  handleWeightChange: (val: number) => state.setIntakeForm((f) => ({ ...f, weightKg: val })),
  handleUrgencyChange: (val: 'Standard' | 'Expedited' | 'Life-Critical') => state.setIntakeForm((f) => ({ ...f, urgency: val })),
  handlePhoneChange: (val: string) => state.setIntakeForm((f) => ({ ...f, recipientPhone: val })),
  handleEmailChange: (val: string) => state.setIntakeForm((f) => ({ ...f, recipientEmail: val })),
  handlePriorityFilterChange: (val: string) => state.setPriorityFilter(val),
  handleConsignmentSelectChange: (val: string) => state.setSelectedConsignmentId(val),
  handleVehicleSelectChange: (val: string) => state.setSelectedVehicleId(val),
  handleDriverSelectChange: (val: string) => state.setSelectedDriverId(val),
  handleTelemetryShipmentChange: (val: string) => state.setTelemetryShipmentId(val),
  handleTelemetryTempChange: (val: number) => state.setTelemetryTemp(val),
  handleTelemetryLatChange: (val: number) => state.setTelemetryLat(val),
  handleTelemetryLngChange: (val: number) => state.setTelemetryLng(val),
  handleDeliveryShipmentChange: (val: string) => state.setDeliveryShipmentId(val),
  handleDriverLatChange: (val: number) => state.setDriverGpsLat(val),
  handleDriverLngChange: (val: number) => state.setDriverGpsLng(val),
  handleOtpChange: (val: string) => state.setEnteredOtp(val),
  handleRecipientNameChange: (val: string) => state.setRecipientName(val),
  handleRecipientTitleChange: (val: string) => state.setRecipientJobTitle(val),
  handleSignatureChange: (val: string) => state.setSignatureData(val),
  onTabIntake: () => setters.setActiveTab?.('intake'),
  onTabDispatch: () => setters.setActiveTab?.('dispatch'),
  onTabTelemetry: () => setters.setActiveTab?.('telemetry'),
  onTabDelivery: () => setters.setActiveTab?.('delivery'),
  onDescriptionChange: (e: React.ChangeEvent<HTMLInputElement>) => state.setIntakeForm((f) => ({ ...f, itemDescription: e.target.value })),
  onMinTempChange: (e: React.ChangeEvent<HTMLInputElement>) => state.setIntakeForm((f) => ({ ...f, minTempC: parseFloat(e.target.value) || 0 })),
  onMaxTempChange: (e: React.ChangeEvent<HTMLInputElement>) => state.setIntakeForm((f) => ({ ...f, maxTempC: parseFloat(e.target.value) || 0 })),
  onWeightChange: (e: React.ChangeEvent<HTMLInputElement>) => state.setIntakeForm((f) => ({ ...f, weightKg: parseFloat(e.target.value) || 0 })),
  onUrgencyChange: (e: React.ChangeEvent<HTMLSelectElement>) => state.setIntakeForm((f) => ({ ...f, urgency: e.target.value as 'Standard' | 'Expedited' | 'Life-Critical' })),
  onPhoneChange: (e: React.ChangeEvent<HTMLInputElement>) => state.setIntakeForm((f) => ({ ...f, recipientPhone: e.target.value })),
  onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => state.setIntakeForm((f) => ({ ...f, recipientEmail: e.target.value })),
  onPriorityFilterChange: (e: React.ChangeEvent<HTMLSelectElement>) => state.setPriorityFilter(e.target.value),
  onConsignmentSelectChange: (e: React.ChangeEvent<HTMLSelectElement>) => state.setSelectedConsignmentId(e.target.value),
  onVehicleSelectChange: (e: React.ChangeEvent<HTMLSelectElement>) => state.setSelectedVehicleId(e.target.value),
  onDriverSelectChange: (e: React.ChangeEvent<HTMLSelectElement>) => state.setSelectedDriverId(e.target.value),
  onTelemetryShipmentChange: (e: React.ChangeEvent<HTMLSelectElement>) => state.setTelemetryShipmentId(e.target.value),
  onTelemetryTempChange: (e: React.ChangeEvent<HTMLInputElement>) => state.setTelemetryTemp(parseFloat(e.target.value) || 0),
  onTelemetryLatChange: (e: React.ChangeEvent<HTMLInputElement>) => state.setTelemetryLat(parseFloat(e.target.value) || 0),
  onTelemetryLngChange: (e: React.ChangeEvent<HTMLInputElement>) => state.setTelemetryLng(parseFloat(e.target.value) || 0),
  onDeliveryShipmentChange: (e: React.ChangeEvent<HTMLSelectElement>) => state.setDeliveryShipmentId(e.target.value),
  onDriverLatChange: (e: React.ChangeEvent<HTMLInputElement>) => state.setDriverGpsLat(parseFloat(e.target.value) || 0),
  onDriverLngChange: (e: React.ChangeEvent<HTMLInputElement>) => state.setDriverGpsLng(parseFloat(e.target.value) || 0),
  onOtpChange: (e: React.ChangeEvent<HTMLInputElement>) => state.setEnteredOtp(e.target.value),
  onRecipientNameChange: (e: React.ChangeEvent<HTMLInputElement>) => state.setRecipientName(e.target.value),
  onRecipientTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => state.setRecipientJobTitle(e.target.value),
  onSignatureChange: (e: React.ChangeEvent<HTMLInputElement>) => state.setSignatureData(e.target.value),
  submitIntake: (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    AppActions.performIntake(state.intakeForm, manager, setters.setIntakeSuccess, setters.setIntakeError);
  },
  submitDispatch: () => {
    AppActions.performDispatch(state.selectedConsignmentId, state.selectedVehicleId, state.selectedDriverId, manager, setters.setActiveManifest, setters.setDispatchError);
  },
  submitTelemetry: () => {
    AppActions.performSendTelemetry(state.telemetryShipmentId, state.telemetryLat, state.telemetryLng, state.telemetryTemp, manager, setters.setTelemetryMessage);
  },
  submitArrival: () => {
    AppActions.performRecordArrival(state.deliveryShipmentId, state.driverGpsLat, state.driverGpsLng, manager, setters.setDeliveryError);
  },
  submitCompleteDelivery: () => {
    AppActions.performCompleteDelivery(state.deliveryShipmentId, state.driverGpsLat, state.driverGpsLng, state.enteredOtp, state.recipientName, state.recipientJobTitle, state.signatureData, manager, setters.setPodReceipt, setters.setDeliveryError);
  },
});

export function App({
  title = 'logistics2cicd-frontend',
  initialTab = 'intake',
  managerInstance,
  initialManifest = null,
  initialPod = null,
  initialError = null,
  initialSuccess = null,
}: AppProps) {
  const [manager] = useState<ColdChainManager>(() => managerInstance || new ColdChainManager());
  const [activeTab, setActiveTab] = useState<'intake' | 'dispatch' | 'telemetry' | 'delivery'>(initialTab);

  // Form State: Feature 1
  const [intakeForm, setIntakeForm] = useState<IntakeFormData>({
    itemDescription: 'COVID-19 mRNA Vaccine Booster Pack',
    minTempC: 2.0,
    maxTempC: 8.0,
    weightKg: 25.0,
    lengthCm: 45.0,
    widthCm: 35.0,
    heightCm: 30.0,
    urgency: 'Life-Critical',
    originLat: 47.6062,
    originLng: -122.3321,
    destLat: 37.7749,
    destLng: -122.4194,
    recipientPhone: '+1-555-0188',
    recipientEmail: 'pharmacy@metromed.org',
    recipientName: 'Dr. Evelyn Reed',
  });
  const [intakeError, setIntakeError] = useState<string | null>(initialError);
  const [intakeSuccess, setIntakeSuccess] = useState<string | null>(initialSuccess);

  // Dispatch State: Feature 2
  const [selectedConsignmentId, setSelectedConsignmentId] = useState<string>('shp-sample-01');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('vh-cold-01');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('drv-01');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [dispatchError, setDispatchError] = useState<string | null>(initialError);
  const [activeManifest, setActiveManifest] = useState<LoadingManifest | null>(initialManifest);

  // Telemetry State: Feature 3
  const [telemetryShipmentId, setTelemetryShipmentId] = useState<string>('shp-sample-01');
  const [telemetryLat, setTelemetryLat] = useState<number>(47.6075);
  const [telemetryLng, setTelemetryLng] = useState<number>(-122.3315);
  const [telemetryTemp, setTelemetryTemp] = useState<number>(4.5);
  const [telemetryMessage, setTelemetryMessage] = useState<string | null>(initialError);

  // Delivery State: Feature 4
  const [deliveryShipmentId, setDeliveryShipmentId] = useState<string>('shp-sample-01');
  const [driverGpsLat, setDriverGpsLat] = useState<number>(37.7750);
  const [driverGpsLng, setDriverGpsLng] = useState<number>(-122.4193);
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [recipientName, setRecipientName] = useState<string>('Dr. Evelyn Reed');
  const [recipientJobTitle, setRecipientJobTitle] = useState<string>('Director of Pharmacy');
  const [signatureData, setSignatureData] = useState<string>(
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><path d="M10 20 Q 30 5, 50 20 T 90 20" fill="none" stroke="black" stroke-width="2"/></svg>',
  );
  const [deliveryError, setDeliveryError] = useState<string | null>(initialError);
  const [podReceipt, setPodReceipt] = useState<PodReceipt | null>(initialPod);

  const consignments = manager.getConsignments();
  const vehicles = manager.getVehicles();
  const drivers = manager.getDrivers();

  const handlers = createAppInputHandlers(
    {
      intakeForm, setIntakeForm,
      selectedConsignmentId, setSelectedConsignmentId,
      selectedVehicleId, setSelectedVehicleId,
      selectedDriverId, setSelectedDriverId,
      priorityFilter, setPriorityFilter,
      telemetryShipmentId, setTelemetryShipmentId,
      telemetryLat, setTelemetryLat,
      telemetryLng, setTelemetryLng,
      telemetryTemp, setTelemetryTemp,
      deliveryShipmentId, setDeliveryShipmentId,
      driverGpsLat, setDriverGpsLat,
      driverGpsLng, setDriverGpsLng,
      enteredOtp, setEnteredOtp,
      recipientName, setRecipientName,
      recipientJobTitle, setRecipientJobTitle,
      signatureData, setSignatureData,
    },
    manager,
    {
      setIntakeSuccess, setIntakeError,
      setActiveManifest, setDispatchError,
      setTelemetryMessage, setDeliveryError,
      setPodReceipt, setActiveTab,
    },
  );

  const selectedConsignmentForDelivery = consignments.find((c) => c.id === deliveryShipmentId);
  const distanceToDestMeters = selectedConsignmentForDelivery
    ? calculateDistanceMeters(
        driverGpsLat,
        driverGpsLng,
        selectedConsignmentForDelivery.destLat,
        selectedConsignmentForDelivery.destLng,
      )
    : 9999;
  const isWithinGeofence = distanceToDestMeters < 200.0;

  return (
    <div style={{ fontFamily: 'Segoe UI, system-ui, sans-serif', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '1.5rem' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #334155', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#38bdf8' }}>{title}</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
            Cold-Chain Telematics, Fleet Compatibility & Proof of Delivery Cloud
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            data-testid="tab-intake"
            onClick={handlers.onTabIntake}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'intake' ? '#0284c7' : '#1e293b',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            1. Intake & Constraints
          </button>
          <button
            data-testid="tab-dispatch"
            onClick={handlers.onTabDispatch}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'dispatch' ? '#0284c7' : '#1e293b',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            2. Fleet Dispatch
          </button>
          <button
            data-testid="tab-telemetry"
            onClick={handlers.onTabTelemetry}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'telemetry' ? '#0284c7' : '#1e293b',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            3. Telemetry & Breaches
          </button>
          <button
            data-testid="tab-delivery"
            onClick={handlers.onTabDelivery}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'delivery' ? '#0284c7' : '#1e293b',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            4. Geofence & POD
          </button>
        </div>
      </header>

      {/* Main Content Areas */}
      {activeTab === 'intake' && (
        <section data-testid="section-intake" style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '1.25rem', marginTop: 0, color: '#38bdf8' }}>Feature 1: Cold-Chain Consignment Intake & Constraint Definition</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Register temperature-sensitive shipments with climate thresholds, weight, dimensions, and handling priority.
          </p>

          {intakeError && (
            <div data-testid="intake-error" style={{ background: '#7f1d1d', border: '1px solid #ef4444', color: '#fecaca', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
              {intakeError}
            </div>
          )}

          {intakeSuccess && (
            <div data-testid="intake-success" style={{ background: '#064e3b', border: '1px solid #10b981', color: '#a7f3d0', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
              {intakeSuccess}
            </div>
          )}

          <form onSubmit={handlers.submitIntake} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Item Description</label>
              <input
                data-testid="input-description"
                type="text"
                value={intakeForm.itemDescription}
                onChange={handlers.onDescriptionChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Min Temp (°C)</label>
              <input
                data-testid="input-min-temp"
                type="number"
                step="0.1"
                value={intakeForm.minTempC}
                onChange={handlers.onMinTempChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Max Temp (°C)</label>
              <input
                data-testid="input-max-temp"
                type="number"
                step="0.1"
                value={intakeForm.maxTempC}
                onChange={handlers.onMaxTempChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Package Weight (kg)</label>
              <input
                data-testid="input-weight"
                type="number"
                step="0.1"
                value={intakeForm.weightKg}
                onChange={handlers.onWeightChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Urgency Priority</label>
              <select
                data-testid="select-urgency"
                value={intakeForm.urgency}
                onChange={handlers.onUrgencyChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              >
                <option value="Standard">Standard</option>
                <option value="Expedited">Expedited</option>
                <option value="Life-Critical">Life-Critical</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Recipient Phone</label>
              <input
                data-testid="input-recipient-phone"
                type="text"
                value={intakeForm.recipientPhone}
                onChange={handlers.onPhoneChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Recipient Email</label>
              <input
                data-testid="input-recipient-email"
                type="email"
                value={intakeForm.recipientEmail}
                onChange={handlers.onEmailChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
                required
              />
            </div>

            <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
              <button
                data-testid="btn-submit-intake"
                type="submit"
                style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                Register Cold-Chain Consignment
              </button>
            </div>
          </form>

          {/* Consignments List */}
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#e2e8f0' }}>Registered Consignments ({consignments.length})</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8' }}>
                    <th style={{ padding: '0.5rem' }}>Tracking ID</th>
                    <th style={{ padding: '0.5rem' }}>Item</th>
                    <th style={{ padding: '0.5rem' }}>Temp Threshold</th>
                    <th style={{ padding: '0.5rem' }}>Weight</th>
                    <th style={{ padding: '0.5rem' }}>Priority</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {consignments.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 600, color: '#38bdf8' }}>{c.trackingNumber}</td>
                      <td style={{ padding: '0.5rem' }}>{c.itemDescription}</td>
                      <td style={{ padding: '0.5rem' }}>{c.minTempC}°C to {c.maxTempC}°C</td>
                      <td style={{ padding: '0.5rem' }}>{c.weightKg} kg</td>
                      <td style={{ padding: '0.5rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: c.urgency === 'Life-Critical' ? '#991b1b' : '#334155' }}>
                          {c.urgency}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <span
                          data-testid={`status-${c.id}`}
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            background:
                              c.status === 'Awaiting_Assignment' ? '#ca8a04' :
                              c.status === 'Assigned' ? '#2563eb' :
                              c.status === 'Temperature_Breach' ? '#dc2626' :
                              c.status === 'Delivered' ? '#16a34a' : '#475569',
                          }}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'dispatch' && (
        <section data-testid="section-dispatch" style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '1.25rem', marginTop: 0, color: '#38bdf8' }}>Feature 2: Fleet Compatibility Checking & Dispatch Allocation</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Match unassigned cold-chain cargo to compliant refrigerated vehicles and on-duty drivers.
          </p>

          {dispatchError && (
            <div data-testid="dispatch-error" style={{ background: '#7f1d1d', border: '1px solid #ef4444', color: '#fecaca', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
              {dispatchError}
            </div>
          )}

          {activeManifest && (
            <div data-testid="manifest-card" style={{ background: '#064e3b', border: '1px solid #10b981', color: '#a7f3d0', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Consolidated Vehicle Loading Manifest: {activeManifest.manifestId}</h3>
              <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>Vehicle ID: {activeManifest.vehicleId} | Driver ID: {activeManifest.driverId}</p>
              <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>Total Cargo Weight: {activeManifest.totalWeightKg} kg</p>
              <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>Timestamp: {activeManifest.generatedAt}</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Filter Cargo By Priority</label>
              <select
                data-testid="filter-priority"
                value={priorityFilter}
                onChange={handlers.onPriorityFilterChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              >
                <option value="ALL">All Priorities</option>
                <option value="Life-Critical">Life-Critical Only</option>
                <option value="Expedited">Expedited Only</option>
                <option value="Standard">Standard Only</option>
              </select>

              <label style={{ display: 'block', fontSize: '0.85rem', margin: '1rem 0 0.25rem' }}>Select Unassigned Consignment</label>
              <select
                data-testid="select-consignment"
                value={selectedConsignmentId}
                onChange={handlers.onConsignmentSelectChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              >
                <option value="">-- Choose Consignment --</option>
                {consignments
                  .filter((c) => c.status === 'Awaiting_Assignment')
                  .filter((c) => priorityFilter === 'ALL' || c.urgency === priorityFilter)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.trackingNumber} - {c.itemDescription} ({c.weightKg}kg) [{c.urgency}]
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Select Vehicle</label>
              <select
                data-testid="select-vehicle"
                value={selectedVehicleId}
                onChange={handlers.onVehicleSelectChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} ({v.model}) - {v.isRefrigerated ? 'Refrigerated' : 'DRY VAN'} [{v.currentWeightKg}/{v.maxWeightCapacityKg}kg]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Select Driver</label>
              <select
                data-testid="select-driver"
                value={selectedDriverId}
                onChange={handlers.onDriverSelectChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              >
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.status}) - Routes: {d.activeRoutesCount}/{d.maxRoutesLimit}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <button
              data-testid="btn-assign-fleet"
              onClick={handlers.submitDispatch}
              style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
            >
              Verify Fleet Compatibility & Dispatch
            </button>
          </div>
        </section>
      )}

      {activeTab === 'telemetry' && (
        <section data-testid="section-telemetry" style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '1.25rem', marginTop: 0, color: '#38bdf8' }}>Feature 3: Real-Time Telemetry & Breach Alerting</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Stream IoT compartment temperatures and GPS tracking. Automated alerts trigger after 2 consecutive tolerance breaches.
          </p>

          {telemetryMessage && (
            <div data-testid="telemetry-banner" style={{ background: telemetryMessage.includes('CRITICAL') ? '#7f1d1d' : '#064e3b', border: '1px solid', borderColor: telemetryMessage.includes('CRITICAL') ? '#ef4444' : '#10b981', color: '#fff', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
              {telemetryMessage}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Shipment</label>
              <select
                data-testid="select-telemetry-shipment"
                value={telemetryShipmentId}
                onChange={handlers.onTelemetryShipmentChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              >
                {consignments.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.trackingNumber} ({c.status}) [{c.minTempC}°C to {c.maxTempC}°C]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Compartment Temp (°C)</label>
              <input
                data-testid="input-telemetry-temp"
                type="number"
                step="0.1"
                value={telemetryTemp}
                onChange={handlers.onTelemetryTempChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Current Latitude</label>
              <input
                data-testid="input-telemetry-lat"
                type="number"
                step="0.0001"
                value={telemetryLat}
                onChange={handlers.onTelemetryLatChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Current Longitude</label>
              <input
                data-testid="input-telemetry-lng"
                type="number"
                step="0.0001"
                value={telemetryLng}
                onChange={handlers.onTelemetryLngChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <button
              data-testid="btn-send-telemetry"
              onClick={handlers.submitTelemetry}
              style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
            >
              Transmit IoT Sensor Reading
            </button>
          </div>

          {/* Incident Log */}
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#e2e8f0' }}>Automated Breach Incidents Log</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8' }}>
                    <th style={{ padding: '0.5rem' }}>Incident ID</th>
                    <th style={{ padding: '0.5rem' }}>Shipment</th>
                    <th style={{ padding: '0.5rem' }}>Start Time</th>
                    <th style={{ padding: '0.5rem' }}>Peak Temp</th>
                    <th style={{ padding: '0.5rem' }}>Duration Until Normalization</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {manager.getIncidents().length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No thermal breaches recorded.</td>
                    </tr>
                  ) : (
                    manager.getIncidents().map((inc) => (
                      <tr key={inc.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '0.5rem', color: '#f87171' }}>{inc.id}</td>
                        <td style={{ padding: '0.5rem' }}>{inc.shipmentId}</td>
                        <td style={{ padding: '0.5rem' }}>{inc.startTimestamp}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 600 }}>{inc.peakTemperatureC}°C</td>
                        <td style={{ padding: '0.5rem' }}>{inc.durationSeconds ? `${inc.durationSeconds}s` : 'Active breach in progress'}</td>
                        <td style={{ padding: '0.5rem' }}>{inc.isActive ? 'ACTIVE' : 'NORMALIZED'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'delivery' && (
        <section data-testid="section-delivery" style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '1.25rem', marginTop: 0, color: '#38bdf8' }}>Feature 4: Geofenced Delivery Handoff & Proof of Delivery (POD)</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Requires driver GPS &lt; 200m from destination, 6-digit OTP verification, and digital signature capture.
          </p>

          {deliveryError && (
            <div data-testid="delivery-error" style={{ background: deliveryError.includes('locked') ? '#7f1d1d' : '#1e3a5f', border: '1px solid #38bdf8', color: '#e0f2fe', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
              {deliveryError}
            </div>
          )}

          {podReceipt && (
            <div data-testid="pod-receipt" style={{ background: '#064e3b', border: '1px solid #10b981', color: '#a7f3d0', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Verified POD Certificate: {podReceipt.podId}</h3>
              <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>Delivered At: {podReceipt.deliveredAt}</p>
              <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>Signatory: {podReceipt.recipientName} ({podReceipt.recipientJobTitle})</p>
              <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>Embedded Temperature Readings: {podReceipt.temperatureGraph.length} data point(s)</p>
              <div style={{ marginTop: '0.5rem', background: '#0f172a', padding: '0.5rem', borderRadius: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Digital Signature Vector:</span>
                <div dangerouslySetInnerHTML={{ __html: podReceipt.signatureData }} />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Consignment for Delivery</label>
              <select
                data-testid="select-delivery-consignment"
                value={deliveryShipmentId}
                onChange={handlers.onDeliveryShipmentChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              >
                {consignments.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.trackingNumber} - Status: {c.status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Driver GPS Latitude</label>
              <input
                data-testid="input-driver-lat"
                type="number"
                step="0.0001"
                value={driverGpsLat}
                onChange={handlers.onDriverLatChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Driver GPS Longitude</label>
              <input
                data-testid="input-driver-lng"
                type="number"
                step="0.0001"
                value={driverGpsLng}
                onChange={handlers.onDriverLngChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Destination Proximity</label>
              <div data-testid="geofence-status" style={{ padding: '0.5rem', borderRadius: '4px', background: isWithinGeofence ? '#064e3b' : '#7f1d1d', color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>
                {isWithinGeofence ? `In Geofence (${distanceToDestMeters.toFixed(1)}m < 200m)` : `Outside Geofence (${distanceToDestMeters.toFixed(1)}m >= 200m)`}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button
              data-testid="btn-record-arrival"
              onClick={handlers.submitArrival}
              style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer' }}
            >
              Signal Arrival & Generate 6-Digit OTP
            </button>
          </div>

          <hr style={{ borderColor: '#334155', margin: '1.5rem 0' }} />

          {/* OTP & Signature Verification */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>6-Digit OTP Code</label>
              <input
                data-testid="input-otp"
                type="text"
                maxLength={6}
                value={enteredOtp}
                onChange={handlers.onOtpChange}
                placeholder="e.g. 849201"
                disabled={selectedConsignmentForDelivery?.isLocked}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Failed Attempts: {selectedConsignmentForDelivery?.failedOtpAttempts ?? 0}/3 (Locks on 3rd failure)
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Recipient Name</label>
              <input
                data-testid="input-recipient-name"
                type="text"
                value={recipientName}
                onChange={handlers.onRecipientNameChange}
                disabled={selectedConsignmentForDelivery?.isLocked}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Recipient Job Title</label>
              <input
                data-testid="input-recipient-title"
                type="text"
                value={recipientJobTitle}
                onChange={handlers.onRecipientTitleChange}
                disabled={selectedConsignmentForDelivery?.isLocked}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Signature Vector Path</label>
              <input
                data-testid="input-signature"
                type="text"
                value={signatureData}
                onChange={handlers.onSignatureChange}
                disabled={selectedConsignmentForDelivery?.isLocked}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <button
              data-testid="btn-complete-delivery"
              onClick={handlers.submitCompleteDelivery}
              disabled={!isWithinGeofence || selectedConsignmentForDelivery?.isLocked}
              style={{
                background: !isWithinGeofence || selectedConsignmentForDelivery?.isLocked ? '#475569' : '#16a34a',
                color: '#fff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: !isWithinGeofence || selectedConsignmentForDelivery?.isLocked ? 'not-allowed' : 'pointer',
              }}
            >
              Complete Delivery & Generate POD Receipt
            </button>
          </div>
        </section>
      )}
    </div>
  );
}