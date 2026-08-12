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
}

/** Shape of GET /api/config — everything the public pages need. */
export interface PublicConfig {
  eventTitle: string;
  votingOpen: boolean;
  votesPerVoter: number;
  categories: Category[];
  /** Maps artwork number (string) -> public image URL. */
  artImages: Record<string, string>;
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
}

export interface AdminState {
  eventTitle: string;
  votingOpen: boolean;
  votesPerVoter: number;
  categories: Category[];
  totalVotes: number;
  winner: Winner | null;
  voterCount: number;
  artCount: number;
  artworks: AdminArtwork[];
}

export interface VoterTicket {
  token: string;
  short: string;
  url: string;
  votes: number[];
  voteCount: number;
  qr: string;
}
