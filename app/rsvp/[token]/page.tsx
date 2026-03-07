"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import sha256 from "crypto-js/sha256";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Invite {
  id: number;
  nom: string | null;
  mairie: boolean | null;
  cocktail: boolean | null;
  chateau: boolean | null;
  brunch: boolean | null;
  fk_invitation: string;
  autorisation_ia: boolean | null;
  regime: string | null;
  allergie: string | null;
}

interface Invitation {
  id: string;
  nom: string | null;
  type: string | null;
  hebergement: boolean | null;
  herbergement_nombre: number | null;
  link_music: string | null;
  confirmed_at: string | null;
}

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Page({ params }: PageProps) {
  const { token } = use(params);
  const router = useRouter();
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
          "id, nom, type, hebergement, herbergement_nombre, link_music, confirmed_at",
        )
        .eq("token_hash", hash)
        .single();

      if (invError || !inv) {
        setFetchError("Invitation introuvable.");
        return;
      }

      setInvitation(inv);

      // Check if already confirmed
      if (inv.confirmed_at) {
        setSubmitted(true);
      }

      // 2. Fetch related invites
      const { data: inviteRows, error: invitesError } = await supabase
        .from("invites")
        .select(
          "id, nom, mairie, cocktail, chateau, brunch, fk_invitation, autorisation_ia, regime, allergie",
        )
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
    value: boolean | string | null,
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

  const validateForm = (): boolean => {
    // Vérifier si type est full ou partial-mairie
    const isMailleInvited =
      invitation &&
      (invitation.type === "full" || invitation.type === "partial-mairie");

    // Vérifier Samedi 01/08 si applicable
    if (isMailleInvited) {
      for (const invite of invites) {
        if (invite.mairie === null) {
          alert(
            `Veuillez confirmer votre présence à la mairie pour ${invite.nom || "l'invité"}`,
          );
          return false;
        }
        if (invite.cocktail === null) {
          alert(
            `Veuillez confirmer votre présence au cocktail pour ${invite.nom || "l'invité"}`,
          );
          return false;
        }
      }
    }

    // Vérifier Week-end 08/08 - Samedi
    for (const invite of invites) {
      if (invite.chateau === null) {
        alert(
          `Veuillez confirmer votre présence pour samedi 08 pour ${invite.nom || "l'invité"}`,
        );
        return false;
      }
    }

    // Vérifier IA authorization - uniquement pour les invités qui vont au château
    for (const invite of invites) {
      if (invite.chateau === true && invite.autorisation_ia === null) {
        alert(
          `Veuillez répondre à la question sur l'IA pour ${invite.nom || "l'invité"}`,
        );
        return false;
      }
    }

    // Vérifier hébergement - seulement si au moins un invité va au château
    const hasChateauGuest = invites.some((invite) => invite.chateau === true);
    if (hasChateauGuest && invitation?.hebergement === null) {
      alert("Veuillez confirmer si vous dormez au château");
      return false;
    }

    // Si hébergement = oui, vérifier le nombre de personnes
    if (
      invitation?.hebergement === true &&
      (!invitation.herbergement_nombre || invitation.herbergement_nombre <= 0)
    ) {
      alert("Veuillez indiquer le nombre de personnes pour l'hébergement");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;

    // Valider le formulaire
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Vérifier s'il y a au moins un invité au château
      const hasChateauGuest = invites.some((invite) => invite.chateau === true);

      // Préparer les données nettoyées pour les invites
      const cleanedInvites = invites.map((invite) => {
        const hasConfirmed =
          invite.cocktail === true || invite.chateau === true;
        const cleaned = { ...invite };

        // Si l'invité n'a confirmé ni cocktail ni château, supprimer regime et allergie
        if (!hasConfirmed) {
          cleaned.regime = null;
          cleaned.allergie = null;
        }

        return cleaned;
      });

      // Préparer les données de l'invitation
      let invitationData: any = {
        hebergement: invitation.hebergement,
        herbergement_nombre: invitation.herbergement_nombre,
        link_music: invitation.link_music,
        confirmed_at: new Date().toISOString(),
      };

      // Si aucun invité n'a confirmé le château
      if (!hasChateauGuest) {
        invitationData.link_music = null;
        invitationData.hebergement = false;
        invitationData.herbergement_nombre = 0;
      }

      // Update invitation
      const { error: invError } = await supabase
        .from("invitation")
        .update(invitationData)
        .eq("id", invitation.id);

      if (invError) throw invError;

      // Update invites
      for (const invite of cleanedInvites) {
        const { error: updateError } = await supabase
          .from("invites")
          .update({
            mairie: invite.mairie,
            cocktail: invite.cocktail,
            chateau: invite.chateau,
            brunch: invite.brunch,
            autorisation_ia: invite.autorisation_ia,
            regime: invite.regime,
            allergie: invite.allergie,
          })
          .eq("id", invite.id);

        if (updateError) throw updateError;
      }

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

  const showMairie =
    invitation.type === "full" || invitation.type === "partial-mairie";
  const showChateau =
    invitation.type === "full" || invitation.type === "partial-chateau";

  if (submitted) {
    return (
      <div className="bg-[#F9F6F0] min-h-screen text-slate-800">
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
          <div className="text-center mb-12">
            <p className="text-4xl font-semibold text-[#557C55] mb-2">
              Merci !
            </p>
            <p className="text-lg text-[#557C55]">
              Votre réponse a bien été enregistrée 🎉
            </p>
          </div>

          <div className="bg-white/50 backdrop-blur-sm p-8 rounded-3xl border border-[#557C55]/20 shadow-sm space-y-8">
            <div>
              <h3
                className="text-3xl text-[#557C55] mb-6 text-center italic"
                style={{ fontFamily: "'Dancing Script', cursive" }}
              >
                Récapitulatif de vos réponses
              </h3>
            </div>

            {/* Samedi 01 Confirmations */}
            {showMairie && (
              <div className="space-y-4">
                <h4
                  className="text-2xl text-[#557C55] underline italic"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Samedi 01 Août
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#557C55]/10">
                        <th
                          className="pb-3 px-2 w-1/2"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          Nom
                        </th>
                        <th
                          className="pb-3 px-2 w-1/4 text-center"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          Mairie
                        </th>
                        <th
                          className="pb-3 px-2 w-1/4 text-center"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          Cocktail
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#557C55]/5">
                      {invites.map((invite) => (
                        <tr key={invite.id}>
                          <td className="py-3 px-2 w-1/2">
                            <p
                              style={{
                                fontFamily: "'Playfair Display', serif",
                              }}
                            >
                              {invite.nom}
                            </p>
                          </td>
                          <td className="py-3 px-2 w-1/4 text-center">
                            {invite.mairie === true ? (
                              <span className="inline-block bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full text-xs border border-green-500">
                                ✓ Oui
                              </span>
                            ) : (
                              <span className="inline-block bg-red-100 text-red-800 font-bold px-3 py-1 rounded-full text-xs border border-red-500">
                                ✗ Non
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 w-1/4 text-center">
                            {invite.cocktail === true ? (
                              <span className="inline-block bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full text-xs border border-green-500">
                                ✓ Oui
                              </span>
                            ) : (
                              <span className="inline-block bg-red-100 text-red-800 font-bold px-3 py-1 rounded-full text-xs border border-red-500">
                                ✗ Non
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Adresses Samedi 01 */}
                <div className="space-y-4 mt-4 pt-4 border-t border-[#557C55]/10">
                  {invites.some((invite) => invite.mairie === true) && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm leading-relaxed text-slate-600 flex-1">
                        📍 Mairie: Pl. de la Libération, 93160 Noisy-le-Grand
                      </span>
                      <div className="flex gap-2 flex-shrink-0">
                        <a
                          href="https://waze.com/ul?q=Pl.%20de%20la%20Libert%C3%A9%2093160%20Noisy-le-Grand"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                          title="Ouvrir dans Waze"
                        >
                          <img src="/waze.png" alt="Waze" className="w-4 h-4" />
                          Waze
                        </a>
                        <a
                          href="https://www.google.com/maps/dir/?api=1&destination=Pl.%20de%20la%20Libert%C3%A9%2093160%20Noisy-le-Grand"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                          title="Ouvrir dans Google Maps"
                        >
                          <img
                            src="/maps-512.svg"
                            alt="Maps"
                            className="w-4 h-4"
                          />
                          Maps
                        </a>
                      </div>
                    </div>
                  )}
                  {invites.some((invite) => invite.cocktail === true) && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm leading-relaxed text-slate-600 flex-1">
                        📍 Cocktail: 13 Allée Cérès, 77410 Gressy
                      </span>
                      <div className="flex gap-2 flex-shrink-0">
                        <a
                          href="https://waze.com/ul?q=13%20All%C3%A9e%20C%C3%A9r%C3%A8s%2077410%20Gressy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                          title="Ouvrir dans Waze"
                        >
                          <img src="/waze.png" alt="Waze" className="w-4 h-4" />
                          Waze
                        </a>
                        <a
                          href="https://www.google.com/maps/dir/?api=1&destination=13%20All%C3%A9e%20C%C3%A9r%C3%A8s%2077410%20Gressy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                          title="Ouvrir dans Google Maps"
                        >
                          <img
                            src="/maps-512.svg"
                            alt="Maps"
                            className="w-4 h-4"
                          />
                          Maps
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Week-end 08/08 Confirmations */}
            <div className="space-y-4">
              <h4
                className="text-2xl text-[#557C55] underline italic"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Week-end 08/08
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#557C55]/10">
                      <th
                        className="pb-3 px-2 w-1/2"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        Nom
                      </th>
                      <th
                        className="pb-3 px-2 w-1/4 text-center"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        Samedi Chateau
                      </th>
                      <th
                        className="pb-3 px-2 w-1/4 text-center"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        Dimanche Brunch
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#557C55]/5">
                    {invites.map((invite) => (
                      <tr key={invite.id}>
                        <td className="py-3 px-2 w-1/2">
                          <p
                            style={{
                              fontFamily: "'Playfair Display', serif",
                            }}
                          >
                            {invite.nom}
                          </p>
                        </td>
                        <td className="py-3 px-2 w-1/4 text-center">
                          {invite.chateau === true ? (
                            <span className="inline-block bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full text-xs border border-green-500">
                              ✓ Oui
                            </span>
                          ) : (
                            <span className="inline-block bg-red-100 text-red-800 font-bold px-3 py-1 rounded-full text-xs border border-red-500">
                              ✗ Non
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 w-1/4 text-center">
                          {invite.brunch === true ? (
                            <span className="inline-block bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full text-xs border border-green-500">
                              ✓ Oui
                            </span>
                          ) : (
                            <span className="inline-block bg-red-100 text-red-800 font-bold px-3 py-1 rounded-full text-xs border border-red-500">
                              ✗ Non
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Adresse Château */}
              {invites.some(
                (invite) => invite.chateau === true || invite.brunch === true,
              ) && (
                <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-[#557C55]/10">
                  <span className="text-sm leading-relaxed text-slate-600 flex-1">
                    📍 Château: 17 Rue de Bois Eluis, 77320 Dagny
                  </span>
                  <div className="flex gap-2 flex-shrink-0">
                    <a
                      href="https://waze.com/ul?q=17%20Rue%20de%20Bois%20Eluis%2077320%20Dagny"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                      title="Ouvrir dans Waze"
                    >
                      <img src="/waze.png" alt="Waze" className="w-4 h-4" />
                      Waze
                    </a>
                    <a
                      href="https://www.google.com/maps/dir/?api=1&destination=17%20Rue%20de%20Bois%20Eluis%2077320%20Dagny"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                      title="Ouvrir dans Google Maps"
                    >
                      <img src="/maps-512.svg" alt="Maps" className="w-4 h-4" />
                      Maps
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Hébergement */}
            {invites.some((invite) => invite.chateau === true) && (
              <div className="bg-[#557C55]/5 p-4 rounded-lg">
                <p
                  className="text-lg italic mb-2"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  <strong>Hébergement :</strong>{" "}
                  {invitation.hebergement === true ? (
                    <span className="inline-block bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full text-xs border border-green-500">
                      ✓ Oui
                    </span>
                  ) : (
                    <span className="inline-block bg-red-100 text-red-800 font-bold px-3 py-1 rounded-full text-xs border border-red-500">
                      ✗ Non
                    </span>
                  )}
                </p>
                {invitation.hebergement === true && (
                  <p
                    className="text-lg italic"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    <strong>Nombre de personnes :</strong>{" "}
                    {invitation.herbergement_nombre}
                  </p>
                )}
              </div>
            )}

            {/* Autorisations IA */}
            {invites.some((invite) => invite.chateau === true) && (
              <div className="space-y-3">
                <h4
                  className="text-lg italic text-[#557C55]"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  <strong>Autorisations IA :</strong>
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-[#557C55]/5">
                      {invites.map(
                        (invite) =>
                          invite.chateau === true && (
                            <tr key={invite.id}>
                              <td className="py-3 px-2">
                                <p
                                  style={{
                                    fontFamily: "'Playfair Display', serif",
                                  }}
                                >
                                  {invite.nom}
                                </p>
                              </td>
                              <td className="py-3 px-2">
                                {invite.autorisation_ia === true ? (
                                  <span className="inline-block bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full text-xs border border-green-500">
                                    ✓ Oui
                                  </span>
                                ) : (
                                  <span className="inline-block bg-red-100 text-red-800 font-bold px-3 py-1 rounded-full text-xs border border-red-500">
                                    ✗ Non
                                  </span>
                                )}
                              </td>
                            </tr>
                          ),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Régimes alimentaires */}
            {invites.some(
              (inv) =>
                (inv.regime || inv.allergie) &&
                (inv.cocktail === true || inv.chateau === true),
            ) && (
              <div className="space-y-4">
                <h4
                  className="text-2xl text-[#557C55] underline italic"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Régimes & Allergies
                </h4>
                <div className="space-y-3">
                  {invites.map(
                    (invite) =>
                      (invite.regime || invite.allergie) &&
                      (invite.cocktail === true || invite.chateau === true) && (
                        <div
                          key={invite.id}
                          className="bg-white/30 p-4 rounded-lg"
                        >
                          <p
                            className="font-semibold text-[#557C55]"
                            style={{ fontFamily: "'Playfair Display', serif" }}
                          >
                            {invite.nom}
                          </p>
                          {invite.regime && (
                            <p className="text-sm text-slate-600">
                              <strong>Régime :</strong> {invite.regime}
                            </p>
                          )}
                          {invite.allergie && (
                            <p className="text-sm text-slate-600">
                              <strong>Allergie :</strong> {invite.allergie}
                            </p>
                          )}
                        </div>
                      ),
                  )}
                </div>
              </div>
            )}
            {/* Chansons proposées */}
            {invites.some((invite) => invite.chateau === true) && (
              <div className="bg-[#557C55]/5 p-4 rounded-lg">
                <p
                  className="text-lg italic mb-2"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  <strong>Chansons proposées :</strong>
                </p>
                <p
                  className="text-base italic whitespace-pre-wrap"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {invitation.link_music}
                </p>
              </div>
            )}

            <div className="flex justify-center pt-8">
              <button
                onClick={() => setSubmitted(false)}
                className="bg-[#557C55] text-white text-lg px-8 py-3 rounded-full shadow-lg hover:bg-[#557C55]/90 transform hover:scale-105 transition-all duration-300 italic cursor-pointer"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Modifier mon invitation
              </button>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 right-0 w-full h-32 overflow-hidden pointer-events-none opacity-40 z-0">
          <img
            alt="Watercolor flowers"
            className="absolute -bottom-10 -right-10 w-80"
            style={{ transform: "rotate(-15deg)" }}
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6rBZ8ZmP_M_XzQav-GFKRyookq-pKrwmiUd74fgUuXXRzfHs0aP_pqEwOvBxpNDaH-IG5pqQgJtYumA4294vYH2st-TvmpQzz1yh1E-Lkoa2-Plspf3BLXvyi1PmbUkkjr4ndJ9pLGwrBcMe0Eu_9QlXCh8YhUAwwhkVETOTpjFFT4n-duhkrFSegGdXhzFOOZ6cwVQ97Gz0pEXHhOBlGM0VSCU71tw_Qq-cRcPQb2c5Ex4lDxcAZB59_oi7rVf-De68Wi1fVEKo"
          />
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-[#F9F6F0] min-h-screen text-slate-800">
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
              src="/DylanLina.png"
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
              {/* Samedi 1er Août - Conditionnel */}
              {(invitation.type === "full" ||
                invitation.type === "partial-mairie") && (
                <div>
                  <h4
                    className="text-2xl text-[#557C55] mb-10 text-center uppercase tracking-widest border-b border-[#557C55]/10 pb-4"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Samedi 01 Août 2026
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-2 justify-center md:max-w-md md:mx-auto">
                    <div className="text-center flex flex-col items-center group">
                      <div
                        className="mb-4 text-[#557C55] opacity-60 text-lg italic"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        15:00
                      </div>
                      <div className="w-14 h-14 rounded-full bg-white border border-[#557C55]/20 flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                        <span className="text-[#557C55] text-2xl">💍</span>
                      </div>
                      <p
                        className="text-lg leading-tight"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        Mariage à la Mairie de Noisy-le-Grand
                      </p>
                      <p className="text-sm text-slate-600 mt-2">
                        📍 Pl. de la Libération, 93160 Noisy-le-Grand
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
                        <span className="text-[#557C55] text-2xl">🍾</span>
                      </div>
                      <p
                        className="text-lg leading-tight"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        Cocktail à Gressy, Chez les parents de Dylan
                      </p>
                      <p className="text-sm text-slate-600 mt-2">
                        📍 13 Allée Cérès, 77410 Gressy
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Samedi */}
              <div>
                <div className="text-center mb-8">
                  <h4
                    className="text-2xl text-[#557C55] uppercase tracking-widest border-b border-[#557C55]/10 pb-4"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Samedi 08 Août 2026
                  </h4>
                  <p className="text-sm text-slate-600 mt-3">
                    📍 17 Rue de Bois Eluis, 77320 Dagny
                  </p>
                </div>
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
                      Rafraîchissements &amp; Vin d'Honneur
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
                <div className="text-center mb-8">
                  <h4
                    className="text-2xl text-[#557C55] uppercase tracking-widest border-b border-[#557C55]/10 pb-4"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Dimanche 09 Août 2026
                  </h4>
                  <p className="text-sm text-slate-600 mt-3">
                    📍 17 Rue de Bois Eluis, 77320 Dagny
                  </p>
                </div>
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
                      Brunch
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Confirmation Table Samedi 01 Août */}
          {(invitation.type === "full" ||
            invitation.type === "partial-mairie") && (
            <section className="bg-white/50 backdrop-blur-sm p-8 rounded-3xl border border-[#557C55]/20 shadow-sm">
              <h3
                className="text-3xl text-[#557C55] mb-8 text-center italic"
                style={{ fontFamily: "'Dancing Script', cursive" }}
              >
                Samedi 01/08 - Je confirme ma présence
                <span className="text-red-600"> *</span>
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
                        Mairie
                      </th>
                      <th
                        className="pb-4 text-xl text-center"
                        style={{
                          fontFamily: "'Playfair Display', serif",
                          fontStyle: "italic",
                        }}
                      >
                        Cocktail
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
                                checked={invite.cocktail === true}
                                onChange={() =>
                                  updateInvite(invite.id, "cocktail", true)
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
                                checked={invite.cocktail === false}
                                onChange={() =>
                                  updateInvite(invite.id, "cocktail", false)
                                }
                                className="text-[#557C55] h-4 w-4"
                              />
                            </label>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Confirmation Table */}
          <section className="bg-white/50 backdrop-blur-sm p-8 rounded-3xl border border-[#557C55]/20 shadow-sm">
            <h3
              className="text-3xl text-[#557C55] mb-8 text-center italic"
              style={{ fontFamily: "'Dancing Script', cursive" }}
            >
              Week-end 08/08 - Je confirme ma présence
              <span className="text-red-600"> *</span>
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
                              checked={invite.chateau === true}
                              onChange={() =>
                                updateInvite(invite.id, "chateau", true)
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
                              checked={invite.chateau === false}
                              onChange={() =>
                                updateInvite(invite.id, "chateau", false)
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
                            Brunch
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
                            disabled={invite.chateau === false}
                            className="rounded text-[#557C55] h-5 w-5 border-[#557C55]/30 disabled:opacity-50 disabled:cursor-not-allowed"
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
          {invites.some(
            (invite) => invite.chateau === true || invite.cocktail === true,
          ) && (
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
                  Indiquez nous si vos restrictions alimentaires
                </p>
              </div>
              <div className="space-y-8">
                {invites.map(
                  (invite, index) =>
                    (invite.chateau === true || invite.cocktail === true) && (
                      <div
                        key={invite.id}
                        className="bg-white/50 backdrop-blur-sm p-6 rounded-3xl border border-[#557C55]/20 shadow-sm"
                      >
                        <h4
                          className="text-2xl text-[#557C55] mb-6 italic"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          {invite.nom ?? `Invité ${index + 1}`}
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <label
                              className="block italic text-lg mb-2"
                              style={{
                                fontFamily: "'Playfair Display', serif",
                              }}
                            >
                              Régime alimentaire :
                            </label>
                            <input
                              type="text"
                              value={invite.regime ?? ""}
                              onChange={(e) =>
                                updateInvite(
                                  invite.id,
                                  "regime",
                                  e.target.value,
                                )
                              }
                              placeholder="Ex: Végétarien / sans lactose / sans gluten"
                              className="w-full bg-transparent border-0 border-b border-[#557C55]/30 focus:ring-0 focus:border-[#557C55] px-0"
                            />
                          </div>
                          <div>
                            <label
                              className="block italic text-lg mb-2"
                              style={{
                                fontFamily: "'Playfair Display', serif",
                              }}
                            >
                              Allergie à préciser :
                            </label>
                            <input
                              type="text"
                              value={invite.allergie ?? ""}
                              onChange={(e) =>
                                updateInvite(
                                  invite.id,
                                  "allergie",
                                  e.target.value,
                                )
                              }
                              placeholder="Ex: arachides, fruits de mer..."
                              className="w-full bg-transparent border-0 border-b border-[#557C55]/30 focus:ring-0 focus:border-[#557C55] px-0"
                            />
                          </div>
                        </div>
                      </div>
                    ),
                )}
              </div>
            </section>
          )}

          {/* Accommodation Section */}
          {invites.some((invite) => invite.chateau === true) && (
            <section className="space-y-6">
              <h3
                className="text-4xl text-[#557C55] italic text-center"
                style={{ fontFamily: "'Dancing Script', cursive" }}
              >
                Hébergement
                <span className="text-red-600"> *</span>
              </h3>
              <div className="bg-[#557C55]/5 p-8 rounded-3xl text-center border-2 border-dashed border-[#557C55]/20">
                <p
                  className="text-sm tracking-widest font-semibold mb-6 max-w-lg mx-auto leading-relaxed uppercase"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  Il sera possible de dormir au château du samedi au dimanche.
                  Une petite participation, autour de 30-40€ par personne, vous
                  sera demandée :)
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
                          onChange={() => {
                            updateInvitation("hebergement", false);
                            updateInvitation("herbergement_nombre", null);
                          }}
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
                  {invitation.hebergement && (
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xl whitespace-nowrap italic"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        Nombre de personnes :
                        <span className="text-red-600"> *</span>
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
                  )}
                </div>
              </div>
            </section>
          )}

          {/* AI Authorization Section */}
          {invites.some((invite) => invite.chateau === true) && (
            <section className="space-y-6">
              <h3
                className="text-4xl text-[#557C55] italic text-center"
                style={{ fontFamily: "'Dancing Script', cursive" }}
              >
                Génération d'images par IA
                <span className="text-red-600"> *</span>
              </h3>
              <div className="bg-blue-50/50 p-8 rounded-3xl text-center border-2 border-blue-200/50">
                <p
                  className="text-sm tracking-widest font-semibold mb-4 max-w-lg mx-auto leading-relaxed uppercase"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  Nous souhaitons générer des images créatives à partir de
                  photos en utilisant l&apos;IA Grok. Ces images seront à but
                  privé et seront uniquement partages entre nous.
                </p>
                <p
                  className="text-sm tracking-widest font-semibold mb-8 max-w-lg mx-auto leading-relaxed italic text-blue-700"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  ⚠️ Aucune obligation - Votre réponse est entièrement
                  volontaire. Vous pouvez refuser sans aucun problème.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-blue-200">
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
                          Autorisation
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100">
                      {invites.map(
                        (invite) =>
                          invite.chateau === true && (
                            <tr key={invite.id}>
                              <td
                                className="py-6"
                                style={{
                                  fontFamily: "'Playfair Display', serif",
                                }}
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
                                      checked={invite.autorisation_ia === true}
                                      onChange={() =>
                                        updateInvite(
                                          invite.id,
                                          "autorisation_ia",
                                          true,
                                        )
                                      }
                                      className="text-blue-500 h-4 w-4"
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
                                      checked={invite.autorisation_ia === false}
                                      onChange={() =>
                                        updateInvite(
                                          invite.id,
                                          "autorisation_ia",
                                          false,
                                        )
                                      }
                                      className="text-blue-500 h-4 w-4"
                                    />
                                  </label>
                                </div>
                              </td>
                            </tr>
                          ),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Music Section */}
          {invites.some((invite) => invite.chateau === true) && (
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
                  chansons qui vous feront danser
                </p>
                <textarea
                  value={invitation.link_music ?? ""}
                  onChange={(e) =>
                    updateInvitation("link_music", e.target.value)
                  }
                  placeholder="Ex: Levitating - Dua Lipa, Bande Organisée - Jul..."
                  rows={4}
                  className="w-full bg-[#F9F6F0]/50 border-2 border-[#557C55]/10 rounded-2xl p-4 focus:ring-[#557C55] focus:border-[#557C55] placeholder:italic"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                />
              </div>
              <div className="flex justify-center pt-8">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#557C55] text-white text-2xl px-12 py-4 rounded-full shadow-lg hover:bg-[#557C55]/90 transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer italic"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {loading ? "Envoi en cours..." : "Envoyer ma réponse"}
                </button>
              </div>
            </section>
          )}

          {!invites.some((invite) => invite.chateau === true) && (
            <div className="flex justify-center pt-8 pb-12">
              <button
                type="submit"
                disabled={loading}
                className="bg-[#557C55] text-white text-2xl px-12 py-4 rounded-full shadow-lg hover:bg-[#557C55]/90 transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer italic"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {loading ? "Envoi en cours..." : "Envoyer ma réponse"}
              </button>
            </div>
          )}
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
          <img src="/alune.png" alt="Alune" className="w-48 mx-auto -mt-8" />
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
    </div>
  );
}
