export type Building = {
  id: string;
  address: string;
  lat: number;
  lng: number;
  scan_url: string | null;
  is_demo: boolean;
  created_at: string;
};

export type ScenarioParams = {
  wind_mph: number;
  surge_ft: number;
  rainfall_in: number;
};

export type PreplanSummary = {
  id: string;
  created_at: string;
  scenario_params: Partial<ScenarioParams> | null;
  building: { address: string } | null;
};

export type RiskScore = "LOW" | "MODERATE" | "HIGH" | "SEVERE";

export type Annotation3D = {
  label: string;
  severity: RiskScore;
  anchor_description: string;
};

export type Hazard = {
  risk_score: RiskScore;
  vulnerable_features: string[];
  operational_guidance: {
    approach_direction: string;
    evacuation_priority?: string;
  };
  annotations_3d: Annotation3D[];
};

export type NearbyPlace = { name: string; distance_mi: number };

export type Preplan = {
  building_profile: {
    address: string;
    type: string;
    construction: string;
    estimated_height_ft: number;
    estimated_occupancy: string;
    year_built_estimate: string;
  };
  context: {
    flood_zone: string;
    surge_zone: string;
    nearest_hospital: NearbyPlace;
    nearest_shelter: NearbyPlace;
  };
  summary: {
    headline_risk: string;
    "30_second_size_up": string;
  };
  hazards: {
    wind: Hazard;
    surge: Hazard;
    flood: Hazard;
  };
};
