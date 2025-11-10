// Types for public project sharing functionality

export interface ProjectPublicLink {
  id: string;
  project_id: string;
  token: string;
  permission: 'view';
  allow_export: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  created_by: string;
  created_at: string;
}

export interface PublicProjectResponse {
  project: {
    id: string;
    customerName: string;
    address: string;
    notes: string;
    updatedAt: string;
    components: any[];
  };
  allow_export: boolean;
}

export interface CreatePublicLinkParams {
  project_id: string;
  allow_export?: boolean;
  expires_at?: string | null;
}