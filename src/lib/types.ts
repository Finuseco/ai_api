
export interface DevPortalUser {
    id: number;
    username: string;
    company_name: string;
    manager_name: string;
    email: string;
    phone: string;
    employee_count: number;
    b2b_user_id: number | null;
}

export interface User {
    id: number;
    role: 'Client' | 'Agent' | 'Admin' | 'Seller' | 'Manager' | 'PartnerB2B' | 'Publisher' | 'Guarantor' | 'SuperAgent' | 'SubSuperAgent';
    id_wallet?: string | null;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    country: string | null;
    pin_hash?: string | null;
    api_key?: string | null;
    api_secret?: string | null;
    test_api_key?: string | null;
    test_api_secret?: string | null;
    sms_sender_id?: string | null;
}

export interface PartnerTransaction {
    reference: string;
    type: string;
    amount: number;
    currency: string;
    description: string;
    date: string;
    status: 'Completed' | 'Pending' | 'Failed' | 'Reversed';
}

export interface HsmKey {
    id: number;
    hsm_signature: string;
    amount: number;
    currency: string;
    status: 'active' | 'claimed' | 'cancelled';
    key_reference: string;
    created_at: string;
    claimed_at?: string | null;
}
