export type BeltColor =
  | 'bijeli'
  | 'žuti'
  | 'narančasti'
  | 'zeleni'
  | 'plavi'
  | 'smeđi'
  | 'crni-1'
  | 'crni-2'
  | 'crni-3';

export type MemberStatus = 'aktivan' | 'neaktivan' | 'suspendiran';

export type TipClanstva = 'redovni' | 'podupiruci' | 'pocasni';

export type DocumentStatus = 'nacrt' | 'na_odobrenju' | 'usvojeno';

export type MeetingStatus = 'planirana' | 'završena' | 'otkazana';

export type CompetitionType = 'kata' | 'kumite' | 'oboje';

export interface Club {
  id: string;
  name: string;
  shortName: string;
  oib: string;
  address: string;
  city: string;
  founded: number;
  presidentName: string;
  presidentMandateExpiry: string;
  secretaryName: string;
  email: string;
  phone: string;
  memberCount: number;
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  memberSince: string;
  belt: BeltColor;
  status: MemberStatus;
  medicalExpiry: string;
  consentSigned: boolean;
  adresa?: string;
  tipClanstva?: TipClanstva;
  guardian?: string;
  notes?: string;
  avatar?: string;
  category: 'kadet' | 'junior' | 'senior' | 'veteran' | 'mali_karatist';
  // HKS registration fields
  oib?: string;
  spol?: 'M' | 'Ž';
  mjestRodjenja?: string;
  drzavaRodjenja?: string;
  // Billing
  oslobodjenClanarina?: boolean;  // UO odluka o izuzeću od plaćanja
}

export interface Meeting {
  id: string;
  type: 'redovna' | 'izvanredna' | 'osnivačka';
  date: string;
  time: string;
  location: string;
  agenda: string[];
  status: MeetingStatus;
  attendees: string[];
  notes?: string;
  documents: Document[];
}

export interface Document {
  id: string;
  meetingId?: string;
  type: 'zapisnik' | 'odluka' | 'izvještaj' | 'ugovor' | 'ostalo';
  title: string;
  status: DocumentStatus;
  createdAt: string;
  content: string;
  author: string;
}

export interface Competition {
  id: string;
  name: string;
  date: string;
  location: string;
  type: CompetitionType;
  level: 'klubsko' | 'županijsko' | 'državno' | 'međunarodno';
  results: CompetitionResult[];
}

export interface CompetitionResult {
  memberId: string;
  memberName: string;
  category: string;
  place: number;
  medal?: 'zlato' | 'srebro' | 'bronca';
  event: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  icon: string;
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  action?: string;
  actionUrl?: string;
  count?: number;
}
