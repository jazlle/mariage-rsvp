import { supabase } from "@/lib/supabase";
import crypto from "crypto";

interface RSVPBody {
  token: string;

  mairie?: boolean;
  cocktail?: boolean;
  chateau?: boolean;

  regime?: string;
  allergie?: string;

  hebergement?: boolean;
  brunch?: boolean;
}

export async function POST(req: Request) {
  const body: RSVPBody = await req.json();

  const tokenHash = crypto
    .createHash("sha256")
    .update(body.token)
    .digest("hex");

  const { error } = await supabase
    .from("invites")
    .update({
      mairie: body.mairie,
      cocktail: body.cocktail,
      chateau: body.chateau,
      regime: body.regime,
      allergie: body.allergie,
      hebergement: body.hebergement,
      brunch: body.brunch,
      confirmed_at: new Date().toISOString()
    })
    .eq("token_hash", tokenHash);

  if (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}