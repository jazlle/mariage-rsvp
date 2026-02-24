export type InviteType =
  | "full"
  | "partial-mairie"
  | "partial-chateau";

export interface Invite {
  id: string;
  nom: {list: string[]};
  type: InviteType;

  token_hash: string;

  mairie: boolean | null;
  cocktail: boolean | null;
  chateau: boolean | null;

  regime: string | null;
  allergie: string | null;

  hebergement: boolean | null;
  brunch: boolean | null;

  confirmed_at: string | null;
}