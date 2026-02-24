"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Invite } from "@/types/invite";
import sha256 from "crypto-js/sha256";

interface PageProps {
  params: {
    token: string;
  };
}

export default function Page({ params }: PageProps) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const hash = sha256(params.token).toString();

      const { data } = await supabase
        .from("invites")
        .select("*")
        .eq("token_hash", hash)
        .single();

      setInvite(data as Invite);
      setLoading(false);
    }

    load();
  }, [params.token]);

  if (loading) return <div>Chargement...</div>;
  if (!invite) return <div>Invitation introuvable</div>;

  return (
    <form className="flex flex-col gap-4 max-w-xl m-auto mt-10">

      <h1>RSVP {invite.nom}</h1>

      {(invite.type === "full" ||
        invite.type === "partial-mairie") && (
        <>
          <label>Mairie</label>
          <input type="checkbox" name="mairie" />

          <label>Cocktail</label>
          <input type="checkbox" name="cocktail" />
        </>
      )}

      {(invite.type === "full" ||
        invite.type === "partial-chateau") && (
        <>
          <label>Château</label>
          <input type="checkbox" name="chateau" />

          <label>Régime</label>
          <select name="regime">
            <option>Standard</option>
            <option>Végétarien</option>
            <option>Halal</option>
          </select>

          <label>Allergies</label>
          <input name="allergie" />

          <label>Hébergement</label>
          <input type="checkbox" name="hebergement" />

          <label>Brunch</label>
          <input type="checkbox" name="brunch" />
        </>
      )}

    </form>
  );
}