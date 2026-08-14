export interface Category {
  id: string;
  name: string;
  /** Inclusive start artwork number, or null when the category has no number range. */
  start: number | null;
  /** Inclusive end artwork number, or null when the category has no number range. */
  end: number | null;
}

export interface AppConfig {
  eventTitle: string;
  adminPin: string;
  votingOpen: boolean;
  votesPerVoter: number;
  categories: Category[];
  blockedArtworks?: number[];
}

/** Shape of GET /api/config — everything the public pages need. */
export interface PublicConfig {
  eventTitle: string;
  votingOpen: boolean;
  votesPerVoter: number;
  categories: Category[];
  /** Maps artwork number (string) -> public image URL. */
  artImages: Record<string, string>;
  blockedArtworks?: number[];
}

export interface Artwork {
  number: number;
  category: Category;
}

export interface Winner {
  number: number;
  category: Category;
  votes: number;
}

export interface AdminArtwork {
  number: number;
  category: Category;
  votes: number;
  /** Votes cast by real voter tickets (not admin-added). */
  publicVotes: number;
  /** Votes added manually by the admin. */
  adminVotes: number;
  blocked?: boolean;
}

export interface AdminState {
  eventTitle: string;
  votingOpen: boolean;
  votesPerVoter: number;
  categories: Category[];
  totalVotes: number;
  /** Votes cast by real voter tickets (not admin-added). */
  totalPublicVotes: number;
  /** Votes added manually by the admin. */
  totalAdminVotes: number;
  winner: Winner | null;
  voterCount: number;
  artCount: number;
  artworks: AdminArtwork[];
  blockedArtworks?: number[];
}

export interface VoterTicket {
  token: string;
  short: string;
  url: string;
  votes: number[];
  voteCount: number;
  qr: string;
  blocked?: boolean;
}
