export interface PoolifyProject {
  id: string;
  owner1: string;
  owner2: string | null;
  siteAddress: string | null;
  homeAddress: string;
  proposalName: string;
  email: string;
  currentStatus: string;
  hasSnapSketch: boolean;
  createdAt: string;
}

export interface PoolifySearchResponse {
  success: boolean;
  count: number;
  results: PoolifyProject[];
  error?: string;
}

export interface PoolifyLinkRequest {
  poolProjectId: string;
  snapsketch: {
    id: string;
    customerName: string;
    address: string;
    embedToken: string;
    embedUrl: string;
    embedCode: string;
    allowExport: boolean;
    expiresAt: string | null;
  };
}

export interface PoolifyLinkStatus {
  success: boolean;
  linked: boolean;
  poolProject?: {
    id: string;
    owner1: string;
    siteAddress: string | null;
    currentStatus: string;
  };
  error?: string;
}
