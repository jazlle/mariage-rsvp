"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "../../../lib/supabase";
import sha256 from "crypto-js/sha256";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Invite {
  id: number;
  nom: string | null;
  mairie: boolean | null;
  chateau: boolean | null;
  cocktail: boolean | null;
  brunch: boolean | null;
  fk_invitation: string;
}

interface Invitation {
  id: string;
  nom: string | null;
  type: string | null;
  regime: string | null;
  allergie: string | null;
  hebergement: boolean | null;
  herbergement_nombre: number | null;
  link_music: string | null;
}

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Page({ params }: PageProps) {
  const { token } = use(params);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Fetch on mount ──────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch invitation by token_hash
      const hash = sha256(token).toString();
      const { data: inv, error: invError } = await supabase
        .from("invitation")
        .select(
          "id, nom, type, regime, allergie, hebergement, herbergement_nombre, link_music",
        )
        .eq("token_hash", hash)
        .single();

      if (invError || !inv) {
        setFetchError("Invitation introuvable.");
        return;
      }

      setInvitation(inv);

      // 2. Fetch related invites
      const { data: inviteRows, error: invitesError } = await supabase
        .from("invites")
        .select("id, nom, mairie, chateau, cocktail, brunch, fk_invitation")
        .eq("fk_invitation", inv.id);

      if (invitesError) {
        setFetchError("Erreur lors du chargement des invités.");
        return;
      }

      setInvites(inviteRows ?? []);
    };

    fetchData();
  }, [token]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const updateInvite = (
    id: number,
    field: keyof Invite,
    value: boolean | null,
  ) => {
    setInvites((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, [field]: value } : inv)),
    );
  };

  const updateInvitation = (
    field: keyof Invitation,
    value: string | boolean | number | null,
  ) => {
    setInvitation((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;
    setLoading(true);
    try {
      const res = await fetch("/api/invitation/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation, invites }),
      });
      if (!res.ok) throw new Error("Erreur lors de l'envoi");
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  // ── Early returns ────────────────────────────────────────────────────────────

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F6F0]">
        <div className="text-center">
          <p className="text-lg text-red-600">{fetchError}</p>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F6F0]">
        <div className="text-center">
          <p className="text-lg text-[#557C55]">
            Chargement de votre invitation…
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F6F0]">
        <div className="text-center">
          <p className="text-4xl font-semibold text-[#557C55] mb-2">Merci !</p>
          <p className="text-lg text-[#557C55]">
            Votre réponse a bien été enregistrée 🎉
          </p>
        </div>
      </div>
    );
  }

  const showMairie =
    invitation.type === "full" || invitation.type === "partial-mairie";
  const showChateau =
    invitation.type === "full" || invitation.type === "partial-chateau";

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <body className="bg-[#F9F6F0] min-h-screen text-slate-800">
      <div className="fixed top-0 left-0 w-full h-24 overflow-hidden pointer-events-none opacity-40 z-0">
        <img
          alt="Watercolor branches"
          className="absolute -top-10 -left-10 w-64 rotate-12"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCDc6l14PkY-_PVtIkSChek6sbL13kBjhJ6sTcGUjDo9WpqU8IBFXIbif3LelRFIdaTjgs2YyWgoVVDKp0Stkb3Ompm7T8fcvSlZrWQbPUm0y8EUOD3gNbZt_QLjzKvcNXzt1bwqmya8vuT0Oqx0Ur7EEaY0V39ZlFIFXhIGWdCJxGKKeg3sp-iiRuqPTNHLPNGjKFZlCHRZAjE7MyieGNdGUY-1eX9x7-b38VixdPVOeIL_L8O0G0mPvuj9TzoJ5_jzwCtYNWyH1c"
        />
        <img
          alt="Watercolor branches"
          className="absolute -top-10 -right-10 w-64 -rotate-12 scale-x-(-1)"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDOO49UwYsuDg_EUJ5LV4pEe6zw1JdTfR5FfG6g_zpknAmXSxo6EwBDOmsy-qkLtiltFa00i1JMPK6MtSXOXI6kYP_bR20f4kXLnxLSVDo7mRfq8tKzRLY-0_D5vtLwsg3rT0wuuNKtnb4lQvOI2fglGe2FCKnGmpWdqbwmOxUKxN6ulO2qmU5AP20JoqoxajbGTnQCp_3ZPL2ta8RLMI9azv4RRL5E5i5mIy8NuzvVVDJ4ltNN3ZzL5AlbKqjhgnB_Jgb0C4jUeSs"
        />
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 relative z-10">
        <header className="text-center mb-16 space-y-6">
          <div className="relative inline-block mb-4">
            <img
              alt="Château Bois Eluis"
              className="w-full max-h-80 object-cover rounded-2xl shadow-xl opacity-90"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDfDw5ppENS0ZXrTydOGqljgglhjbEtIZQRxOw7lpnCw1DpnQiuZitU4cNeMp5_oQa1muselJaT-XwcelcWIjegwEFh_AP5maD7GCR-nVWEZth6qjNdcHtzjMONkErzaXUXNqfuLsuyT8-M_k1kZkB0Cjdf6I-C_mdP99vU-GgIC5Qj8Epu-3mYywx6gDI924pSEhiHiWgW-7irJNQyhRYktqy_S7wCkl25J9ULsgs0wNQwsNx9j9RRcJ5-jp3qf4lbJ_iqdQmOX3s"
            />
            <div className="absolute inset-0 bg-[#557C55]/10 rounded-2xl"></div>
          </div>
          <h2
            className="text-4xl md:text-5xl text-[#557C55] mb-2"
            style={{ fontFamily: "'Dancing Script', cursive" }}
          >
            Mariage
          </h2>
          <h1
            className="text-6xl md:text-8xl text-[#557C55] font-bold"
            style={{ fontFamily: "'Dancing Script', cursive" }}
          >
            Lina &amp; Dylan
          </h1>
          <p
            className="text-2xl mt-6 text-slate-600 italic"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Château Bois Eluis
          </p>
          <p
            className="text-xl tracking-widest uppercase"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Samedi 08 août 2026
          </p>
          <div className="w-24 h-px bg-[#557C55]/30 mx-auto mt-8"></div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-20">
          {/* Invitation Name */}
          <section className="text-center">
            <h3
              className="text-4xl text-[#557C55] mb-2"
              style={{ fontFamily: "'Dancing Script', cursive" }}
            >
              Invitation
            </h3>
            <p
              className="text-2xl text-slate-700"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {invitation.nom ?? "Cher invité"}
            </p>
          </section>
          {/* Programme Section */}
          <section className="space-y-12">
            <div className="text-center">
              <h3
                className="text-5xl text-[#557C55] mb-4 italic"
                style={{ fontFamily: "'Dancing Script', cursive" }}
              >
                Programme des festivités
              </h3>
              <div className="w-16 h-0.5 bg-[#557C55]/20 mx-auto"></div>
            </div>

            <div className="space-y-16">
              {/* Samedi */}
              <div>
                <h4
                  className="text-2xl text-[#557C55] mb-10 text-center uppercase tracking-widest border-b border-[#557C55]/10 pb-4"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Samedi 08 Août
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-2">
                  <div className="text-center flex flex-col items-center group">
                    <div
                      className="mb-4 text-[#557C55] opacity-60 text-lg italic"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      15:30
                    </div>
                    <div className="w-14 h-14 rounded-full bg-white border border-[#557C55]/20 flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                      <span className="text-[#557C55] text-2xl">🌸</span>
                    </div>
                    <p
                      className="text-lg leading-tight"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      Cérémonie Laïque
                    </p>
                  </div>
                  <div className="text-center flex flex-col items-center group">
                    <div
                      className="mb-4 text-[#557C55] opacity-60 text-lg italic"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      16:30
                    </div>
                    <div className="w-14 h-14 rounded-full bg-white border border-[#557C55]/20 flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                      <span className="text-[#557C55] text-2xl">📷</span>
                    </div>
                    <p
                      className="text-lg leading-tight"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      Photographies de Groupe
                    </p>
                  </div>
                  <div className="text-center flex flex-col items-center group">
                    <div
                      className="mb-4 text-[#557C55] opacity-60 text-lg italic"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      17:30
                    </div>
                    <div className="w-14 h-14 rounded-full bg-white border border-[#557C55]/20 flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                      <span className="text-[#557C55] text-2xl">🍾</span>
                    </div>
                    <p
                      className="text-lg leading-tight"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      Cocktail &amp; Rafraîchissements
                    </p>
                  </div>
                  <div className="text-center flex flex-col items-center group">
                    <div
                      className="mb-4 text-[#557C55] opacity-60 text-lg italic"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      20:00
                    </div>
                    <div className="w-14 h-14 rounded-full bg-white border border-[#557C55]/20 flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                      <span className="text-[#557C55] text-2xl">🍽️</span>
                    </div>
                    <p
                      className="text-lg leading-tight"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      Dîner de Noces
                    </p>
                  </div>
                  <div className="text-center flex flex-col items-center group">
                    <div
                      className="mb-4 text-[#557C55] opacity-60 text-lg italic"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      23:00
                    </div>
                    <div className="w-14 h-14 rounded-full bg-white border border-[#557C55]/20 flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                      <span className="text-[#557C55] text-2xl">🎂</span>
                    </div>
                    <p
                      className="text-lg leading-tight"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      Pièce Montée &amp; Soirée
                    </p>
                  </div>
                </div>
              </div>

              {/* Dimanche */}
              <div>
                <h4
                  className="text-2xl text-[#557C55] mb-10 text-center uppercase tracking-widest border-b border-[#557C55]/10 pb-4"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Dimanche 09 Août
                </h4>
                <div className="flex justify-center">
                  <div className="text-center flex flex-col items-center group">
                    <div
                      className="mb-4 text-[#557C55] opacity-60 text-lg italic"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      11:30
                    </div>
                    <div className="w-14 h-14 rounded-full bg-white border border-[#557C55]/20 flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                      <span className="text-[#557C55] text-2xl">🍳</span>
                    </div>
                    <p
                      className="text-lg leading-tight"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      Brunch &amp; BBQ Party
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Confirmation Table */}
          <section className="bg-white/50 backdrop-blur-sm p-8 rounded-3xl border border-[#557C55]/20 shadow-sm">
            <h3
              className="text-3xl text-[#557C55] mb-8 text-center italic"
              style={{ fontFamily: "'Dancing Script', cursive" }}
            >
              Je confirme ma présence
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#557C55]/10">
                    <th
                      className="pb-4 text-xl"
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontStyle: "italic",
                      }}
                    ></th>
                    <th
                      className="pb-4 text-xl text-center"
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontStyle: "italic",
                      }}
                    >
                      Samedi 08
                    </th>
                    <th
                      className="pb-4 text-xl text-center"
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontStyle: "italic",
                      }}
                    >
                      Dimanche 09
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#557C55]/5">
                  {invites.map((invite) => (
                    <tr key={invite.id}>
                      <td
                        className="py-6"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        {invite.nom ?? "Invité"}
                      </td>
                      <td className="py-6 text-center">
                        <div className="flex items-center justify-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span
                              className="text-sm italic"
                              style={{
                                fontFamily: "'Playfair Display', serif",
                              }}
                            >
                              Oui
                            </span>
                            <input
                              type="radio"
                              checked={invite.mairie === true}
                              onChange={() =>
                                updateInvite(invite.id, "mairie", true)
                              }
                              className="text-[#557C55] h-4 w-4"
                            />
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span
                              className="text-sm italic"
                              style={{
                                fontFamily: "'Playfair Display', serif",
                              }}
                            >
                              Non
                            </span>
                            <input
                              type="radio"
                              checked={invite.mairie === false}
                              onChange={() =>
                                updateInvite(invite.id, "mairie", false)
                              }
                              className="text-[#557C55] h-4 w-4"
                            />
                          </label>
                        </div>
                      </td>
                      <td className="py-6 text-center">
                        <label className="flex items-center justify-center gap-2 cursor-pointer">
                          <span
                            className="text-sm italic"
                            style={{ fontFamily: "'Playfair Display', serif" }}
                          >
                            BBQ Party
                          </span>
                          <input
                            type="checkbox"
                            checked={invite.brunch === true}
                            onChange={() =>
                              updateInvite(
                                invite.id,
                                "brunch",
                                invite.brunch === true ? false : true,
                              )
                            }
                            className="rounded text-[#557C55] h-5 w-5 border-[#557C55]/30"
                          />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Dietary Section */}
          <section className="space-y-6">
            <div className="text-center mb-8">
              <h3
                className="text-4xl text-[#557C55] mb-2 italic"
                style={{ fontFamily: "'Dancing Script', cursive" }}
              >
                Mariage gourmand pour tous !
              </h3>
              <p
                className="text-sm tracking-widest font-semibold opacity-80 uppercase"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                N&apos;hésitez pas à nous indiquer si vous avez des restrictions
                alimentaires :)
              </p>
            </div>
            <div className="space-y-6">
              <div>
                <label
                  className="block italic text-lg mb-2"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Régime alimentaire
                </label>
                <input
                  type="text"
                  value={invitation.regime ?? ""}
                  onChange={(e) => updateInvitation("regime", e.target.value)}
                  placeholder="Ex: Végétarien / sans lactose / sans gluten"
                  className="w-full bg-transparent border-0 border-b border-[#557C55]/30 focus:ring-0 focus:border-[#557C55] px-0"
                />
              </div>
              <div>
                <label
                  className="block italic text-lg mb-2"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Allergie à préciser :
                </label>
                <input
                  type="text"
                  value={invitation.allergie ?? ""}
                  onChange={(e) => updateInvitation("allergie", e.target.value)}
                  placeholder="Ex: arachides, fruits de mer..."
                  className="w-full bg-transparent border-0 border-b border-[#557C55]/30 focus:ring-0 focus:border-[#557C55] px-0"
                />
              </div>
            </div>
          </section>

          {/* Accommodation Section */}
          <section className="space-y-6">
            <h3
              className="text-4xl text-[#557C55] italic text-center"
              style={{ fontFamily: "'Dancing Script', cursive" }}
            >
              Hébergement
            </h3>
            <div className="bg-[#557C55]/5 p-8 rounded-3xl text-center border-2 border-dashed border-[#557C55]/20">
              <p
                className="text-sm tracking-widest font-semibold mb-6 max-w-lg mx-auto leading-relaxed uppercase"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                Il sera possible de dormir au château du vendredi au dimanche.
                Une petite participation vous sera demandée :)
              </p>
              <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                <div className="flex items-center gap-6">
                  <span
                    className="text-xl italic"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Je dors au château :
                  </span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={invitation.hebergement === true}
                        onChange={() => updateInvitation("hebergement", true)}
                        className="text-[#557C55]"
                      />
                      <span
                        className="italic"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        Oui
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={invitation.hebergement === false}
                        onChange={() => updateInvitation("hebergement", false)}
                        className="text-[#557C55]"
                      />
                      <span
                        className="italic"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        Non
                      </span>
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xl whitespace-nowrap italic"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Nombre de personnes :
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={invites.length}
                    value={invitation.herbergement_nombre ?? ""}
                    onChange={(e) =>
                      updateInvitation(
                        "herbergement_nombre",
                        e.target.value ? parseInt(e.target.value) : null,
                      )
                    }
                    className="w-16 bg-transparent border-0 border-b border-[#557C55]/30 focus:ring-0 focus:border-[#557C55] px-0 text-center text-xl"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Music Section */}
          <section className="space-y-8 pb-12">
            <div className="text-center">
              <h3
                className="text-5xl text-[#557C55] mb-4 italic"
                style={{ fontFamily: "'Dancing Script', cursive" }}
              >
                Vamos a bailar !
              </h3>
              <div className="flex justify-center items-center gap-4 text-[#557C55]">
                <span className="text-2xl">♪</span>
                <span className="text-3xl">🎵</span>
                <span className="text-2xl">♪</span>
              </div>
            </div>
            <div className="bg-white/60 p-8 rounded-3xl border border-[#557C55]/20 shadow-inner">
              <p
                className="text-sm tracking-widest font-semibold text-center mb-6 leading-relaxed uppercase"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                Parce-qu&apos;on aimerait danser avec vous, partage nous 2
                chansons qui te feront danser
              </p>
              <textarea
                value={invitation.link_music ?? ""}
                onChange={(e) => updateInvitation("link_music", e.target.value)}
                placeholder="Ex: Dancing Queen - ABBA, L'aventurier - Indochine..."
                rows={4}
                className="w-full bg-[#F9F6F0]/50 border-2 border-[#557C55]/10 rounded-2xl p-4 focus:ring-[#557C55] focus:border-[#557C55] placeholder:italic"
                style={{ fontFamily: "'Playfair Display', serif" }}
              />
            </div>
            <div className="flex justify-center pt-8">
              <button
                type="submit"
                disabled={loading}
                className="bg-[#557C55] text-white text-2xl px-12 py-4 rounded-full shadow-lg hover:bg-[#557C55]/90 transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed italic"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {loading ? "Envoi en cours..." : "Envoyer ma réponse"}
              </button>
            </div>
          </section>
        </form>

        <footer className="text-center py-12 border-t border-[#557C55]/10 mt-12">
          <p
            className="text-3xl text-[#557C55]"
            style={{ fontFamily: "'Dancing Script', cursive" }}
          >
            Avec tout notre amour,
          </p>
          <p
            className="text-2xl mt-2"
            style={{ fontFamily: "'Dancing Script', cursive" }}
          >
            Lina &amp; Dylan
          </p>
        </footer>
      </div>

      <div className="fixed bottom-0 right-0 w-full h-32 overflow-hidden pointer-events-none opacity-40 z-0">
        <img
          alt="Watercolor flowers"
          className="absolute -bottom-10 -right-10 w-80"
          style={{ transform: "rotate(-15deg)" }}
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6rBZ8ZmP_M_XzQav-GFKRyookq-pKrwmiUd74fgUuXXRzfHs0aP_pqEwOvBxpNDaH-IG5pqQgJtYumA4294vYH2st-TvmpQzz1yh1E-Lkoa2-Plspf3BLXvyi1PmbUkkjr4ndJ9pLGwrBcMe0Eu_9QlXCh8YhUAwwhkVETOTpjFFT4n-duhkrFSegGdXhzFOOZ6cwVQ97Gz0pEXHhOBlGM0VSCU71tw_Qq-cRcPQb2c5Ex4lDxcAZB59_oi7rVf-De68Wi1fVEKo"
        />
      </div>
    </body>
  );
}
