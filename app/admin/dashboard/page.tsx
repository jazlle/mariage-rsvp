"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

interface Invite {
  id: number;
  nom: string | null;
  mairie: boolean | null;
  cocktail: boolean | null;
  chateau: boolean | null;
  brunch: boolean | null;
  autorisation_ia: boolean | null;
  fk_invitation: string;
}

interface InvitationData {
  id: string;
  nom: string | null;
  type: string | null;
  regime: string | null;
  allergie: string | null;
  hebergement: boolean | null;
  herbergement_nombre: number | null;
  link_music: string | null;
  confirmed_at: string | null;
  url: string | null;
  invites: Invite[];
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvitation, setSelectedInvitation] = useState<string | null>(
    null,
  );
  const [invitationDetails, setInvitationDetails] =
    useState<InvitationData | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [statsModal, setStatsModal] = useState<{
    type: "mairie" | "chateau";
    status: "accepted" | "refused";
    people: { nom: string; invitationNom: string }[];
  } | null>(null);
  const [accommodationModal, setAccommodationModal] = useState<{
    invitations: { nom: string; nombre: number }[];
  } | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        router.push("/admin/login");
        return;
      }

      await fetchInvitations();
    };

    checkAuth();
  }, [router]);

  const fetchInvitations = async () => {
    try {
      setLoading(true);

      // Fetch all invitations
      const { data: invitationsData, error: invError } = await supabase
        .from("invitation")
        .select(
          "id, nom, type, regime, allergie, hebergement, herbergement_nombre, link_music, confirmed_at, url",
        );

      if (invError) {
        setError("Erreur lors du chargement des invitations.");
        return;
      }

      // Fetch all invites for all invitations
      const { data: allInvitesData, error: invitesError } = await supabase
        .from("invites")
        .select(
          "id, nom, mairie, cocktail, chateau, brunch, autorisation_ia, fk_invitation",
        );

      if (invitesError) {
        setError("Erreur lors du chargement des invités.");
        return;
      }

      // Map invites to their invitations
      const invitationsWithInvites: InvitationData[] = (
        invitationsData || []
      ).map((inv) => ({
        ...inv,
        invites: (allInvitesData || []).filter(
          (invite) => invite.fk_invitation === inv.id,
        ),
      }));

      setInvitations(invitationsWithInvites);
    } catch (err) {
      console.error(err);
      setError("Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitationDetails = async (invitationId: string) => {
    try {
      setLoadingDetails(true);

      // Fetch invites for this invitation
      const { data: invitesData, error: invitesError } = await supabase
        .from("invites")
        .select(
          "id, nom, mairie, cocktail, chateau, brunch, autorisation_ia, fk_invitation",
        )
        .eq("fk_invitation", invitationId);

      if (invitesError) {
        setError("Erreur lors du chargement des détails.");
        return;
      }

      // Find the invitation and add the invites
      const invitation = invitations.find((inv) => inv.id === invitationId);
      if (invitation) {
        setInvitationDetails({
          ...invitation,
          invites: invitesData || [],
        });
      }
    } catch (err) {
      console.error(err);
      setError("Une erreur est survenue.");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminId");
    router.push("/admin/login");
  };

  const getTypeLabel = (type: string | null): string => {
    switch (type) {
      case "full":
        return "COMPLÈTE";
      case "partial-mairie":
        return "MAIRIE";
      case "partial-chateau":
        return "CHÂTEAU";
      default:
        return type || "Non spécifié";
    }
  };

  const renderTypeLabel = (type: string | null) => {
    return <span className="font-bold uppercase">{getTypeLabel(type)}</span>;
  };

  const copyToClipboard = async () => {
    if (invitationDetails?.url) {
      await navigator.clipboard.writeText(invitationDetails.url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const calculateStats = () => {
    const stats = {
      complete: { accepted: 0, refused: 0, total: 0 },
      mairie: { accepted: 0, refused: 0, total: 0 },
      chateau: { accepted: 0, refused: 0, total: 0 },
      accommodation: 0,
      regimes: {} as {
        [key: string]: { count: number; invitations: string[] };
      },
    };

    invitations.forEach((inv) => {
      inv.invites.forEach((invite) => {
        // COMPLÈTE: full invitations only
        if (inv.type === "full") {
          stats.complete.total += 1;
          if (invite.chateau === true) stats.complete.accepted += 1;
          if (invite.chateau === false) stats.complete.refused += 1;
        }

        // MAIRIE: full + partial-mairie invitations
        if (inv.type === "full" || inv.type === "partial-mairie") {
          stats.mairie.total += 1;
          if (invite.mairie === true) stats.mairie.accepted += 1;
          if (invite.mairie === false) stats.mairie.refused += 1;
        }

        // CHÂTEAU: full + partial-chateau invitations
        if (inv.type === "full" || inv.type === "partial-chateau") {
          stats.chateau.total += 1;
          if (invite.chateau === true) stats.chateau.accepted += 1;
          if (invite.chateau === false) stats.chateau.refused += 1;
        }
      });

      // Count accommodation
      if (inv.hebergement === true) {
        stats.accommodation += inv.herbergement_nombre || 0;
      }

      // Collect regimes
      if (inv.regime && inv.regime.trim()) {
        if (!stats.regimes[inv.regime]) {
          stats.regimes[inv.regime] = { count: 0, invitations: [] };
        }
        stats.regimes[inv.regime].count += 1;
        stats.regimes[inv.regime].invitations.push(inv.nom || "");
      }
    });

    return stats;
  };

  const stats = calculateStats();

  const getStatsDetails = (
    type: "mairie" | "chateau",
    status: "accepted" | "refused",
  ) => {
    const people: { nom: string; invitationNom: string }[] = [];

    invitations.forEach((inv) => {
      inv.invites.forEach((invite) => {
        let include = false;

        if (type === "mairie") {
          if (
            (inv.type === "full" || inv.type === "partial-mairie") &&
            status === "accepted" &&
            invite.mairie === true
          ) {
            include = true;
          } else if (
            (inv.type === "full" || inv.type === "partial-mairie") &&
            status === "refused" &&
            invite.mairie === false
          ) {
            include = true;
          }
        } else if (type === "chateau") {
          if (
            (inv.type === "full" || inv.type === "partial-chateau") &&
            status === "accepted" &&
            invite.chateau === true
          ) {
            include = true;
          } else if (
            (inv.type === "full" || inv.type === "partial-chateau") &&
            status === "refused" &&
            invite.chateau === false
          ) {
            include = true;
          }
        }

        if (include) {
          people.push({
            nom: invite.nom || "Invité",
            invitationNom: inv.nom || "Invitation",
          });
        }
      });
    });

    return people;
  };

  const getAccommodationDetails = () => {
    const accommodations: { nom: string; nombre: number }[] = [];

    invitations.forEach((inv) => {
      if (inv.hebergement === true) {
        accommodations.push({
          nom: inv.nom || "Invitation",
          nombre: inv.herbergement_nombre || 0,
        });
      }
    });

    return accommodations;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F6F0] flex items-center justify-center">
        <p className="text-lg text-[#557C55]">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#F9F6F0] min-h-screen text-slate-800">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-12">
          <h1
            className="text-5xl text-[#557C55]"
            style={{ fontFamily: "'Dancing Script', cursive" }}
          >
            Administration
          </h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-6 py-3 rounded-full hover:bg-red-700 transition-colors cursor-pointer italic"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Déconnexion
          </button>
        </div>

        {error && (
          <p className="text-red-600 text-center mb-8 text-lg">{error}</p>
        )}

        {/* Résumé des statistiques */}
        <div className="mb-12 space-y-6">
          {/* Tableau d'acceptations/refus par catégorie */}
          <div className="rounded-3xl border border-[#557C55]/20 overflow-hidden">
            <div className="bg-[#557C55] text-white p-6">
              <h2
                className="text-2xl italic"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Résumé des confirmations
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/50 border-b border-[#557C55]/20">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold text-[#557C55]">
                      Catégorie
                    </th>
                    <th className="px-6 py-4 text-center font-semibold text-[#557C55]">
                      Confirmés
                    </th>
                    <th className="px-6 py-4 text-center font-semibold text-[#557C55]">
                      Refusés
                    </th>
                    <th className="px-6 py-4 text-center font-semibold text-[#557C55]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#557C55]/10">
                  <tr className="hover:bg-white/30">
                    <td className="px-6 py-4 font-semibold">MAIRIE</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() =>
                          setStatsModal({
                            type: "mairie",
                            status: "accepted",
                            people: getStatsDetails("mairie", "accepted"),
                          })
                        }
                        className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full cursor-pointer hover:bg-green-200 transition-colors"
                      >
                        {stats.mairie.accepted}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() =>
                          setStatsModal({
                            type: "mairie",
                            status: "refused",
                            people: getStatsDetails("mairie", "refused"),
                          })
                        }
                        className="bg-red-100 text-red-800 font-bold px-3 py-1 rounded-full cursor-pointer hover:bg-red-200 transition-colors"
                      >
                        {stats.mairie.refused}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center font-bold">
                      {stats.mairie.total}
                    </td>
                  </tr>
                  <tr className="hover:bg-white/30">
                    <td className="px-6 py-4 font-semibold">CHÂTEAU</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() =>
                          setStatsModal({
                            type: "chateau",
                            status: "accepted",
                            people: getStatsDetails("chateau", "accepted"),
                          })
                        }
                        className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full cursor-pointer hover:bg-green-200 transition-colors"
                      >
                        {stats.chateau.accepted}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() =>
                          setStatsModal({
                            type: "chateau",
                            status: "refused",
                            people: getStatsDetails("chateau", "refused"),
                          })
                        }
                        className="bg-red-100 text-red-800 font-bold px-3 py-1 rounded-full cursor-pointer hover:bg-red-200 transition-colors"
                      >
                        {stats.chateau.refused}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center font-bold">
                      {stats.chateau.total}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Hébergement et régimes alimentaires */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hébergement */}
            <div className="rounded-3xl border border-[#557C55]/20 overflow-hidden">
              <div className="bg-[#557C55] text-white p-6">
                <h2
                  className="text-2xl italic"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Hébergement
                </h2>
              </div>
              <div className="p-6">
                <p className="text-lg">
                  <strong className="text-[#557C55]">
                    Personnes à héberger :
                  </strong>{" "}
                  <button
                    onClick={() =>
                      setAccommodationModal({
                        invitations: getAccommodationDetails(),
                      })
                    }
                    className="text-3xl font-bold text-[#557C55] bg-green-100 px-3 py-1 rounded-full cursor-pointer hover:bg-green-200 transition-colors"
                  >
                    {stats.accommodation}
                  </button>
                </p>
              </div>
            </div>

            {/* Régimes alimentaires */}
            <div className="rounded-3xl border border-[#557C55]/20 overflow-hidden">
              <div className="bg-[#557C55] text-white p-6">
                <h2
                  className="text-2xl italic"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Régimes alimentaires
                </h2>
              </div>
              <div className="p-6 space-y-3">
                {Object.keys(stats.regimes).length === 0 ? (
                  <p className="text-slate-600 italic">Aucun régime spécifié</p>
                ) : (
                  Object.entries(stats.regimes).map(([regime, data]) => (
                    <div
                      key={regime}
                      className="border-b border-[#557C55]/20 pb-3"
                    >
                      <p className="font-semibold text-[#557C55]">{regime}</p>
                      <p className="text-sm text-slate-600">
                        {data.invitations.join(", ")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-[#557C55]/20 overflow-hidden">
          <div className="bg-[#557C55] text-white p-6">
            <h2
              className="text-2xl italic"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Invitations ({invitations.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/50 border-b border-[#557C55]/20">
                <tr>
                  <th
                    className="px-6 py-4 text-left font-semibold text-[#557C55] italic"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Nom
                  </th>
                  <th
                    className="px-6 py-4 text-left font-semibold text-[#557C55] italic"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Type invitation
                  </th>
                  <th
                    className="px-6 py-4 text-left font-semibold text-[#557C55] italic"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Confirmée
                  </th>
                  <th
                    className="px-6 py-4 text-left font-semibold text-[#557C55] italic"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#557C55]/10">
                {invitations.map((invitation) => (
                  <tr key={invitation.id} className="hover:bg-white/30">
                    <td className="px-6 py-4">{invitation.nom}</td>
                    <td className="px-6 py-4">
                      {renderTypeLabel(invitation.type)}
                    </td>
                    <td className="px-6 py-4">
                      {invitation.confirmed_at ? (
                        <span className="inline-block bg-green-100 text-green-800 font-bold px-4 py-2 rounded-full text-sm border-2 border-green-500">
                          ✓ Confirmé
                        </span>
                      ) : (
                        <span className="inline-block bg-red-100 text-red-800 font-bold px-4 py-2 rounded-full text-sm border-2 border-red-500">
                          ✗ Non confirmé
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          if (selectedInvitation === invitation.id) {
                            setSelectedInvitation(null);
                            setInvitationDetails(null);
                          } else {
                            setSelectedInvitation(invitation.id);
                            fetchInvitationDetails(invitation.id);
                          }
                        }}
                        className="bg-[#557C55] text-white px-5 py-2 rounded-full font-semibold hover:bg-[#557C55]/90 transition-all hover:shadow-lg active:scale-95 cursor-pointer"
                      >
                        Détails
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Détails de l'invitation sélectionnée - Modale */}
        {selectedInvitation && invitationDetails && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#F9F6F0] rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {loadingDetails ? (
                <div className="p-8 text-center text-[#557C55]">
                  <p>Chargement des détails...</p>
                </div>
              ) : (
                <>
                  <div className="bg-[#557C55] text-white p-6 flex justify-between items-center sticky top-0">
                    <h2
                      className="text-2xl italic"
                      style={{ fontFamily: "'Dancing Script', cursive" }}
                    >
                      {invitationDetails?.nom}
                    </h2>
                    <button
                      onClick={() => {
                        setSelectedInvitation(null);
                        setInvitationDetails(null);
                      }}
                      className="text-2xl cursor-pointer hover:scale-125 transition-transform"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-8 space-y-6">
                    {/* URL de l'invitation */}
                    <div className="bg-white/50 p-4 rounded-lg border border-[#557C55]/20">
                      <p
                        className="text-sm font-semibold mb-2 text-[#557C55]"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        Lien d'invitation
                      </p>
                      <div className="flex gap-2 items-center flex-wrap">
                        <a
                          href={invitationDetails?.url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-0 text-[#557C55] hover:underline break-all text-sm cursor-pointer"
                        >
                          {invitationDetails?.url}
                        </a>
                        <button
                          onClick={copyToClipboard}
                          className="bg-[#557C55] text-white px-4 py-2 rounded-full text-sm hover:bg-[#557C55]/90 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {copiedUrl ? "✓ Copié" : "Copier"}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3
                          className="text-lg font-semibold text-[#557C55] mb-4"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          Informations générales
                        </h3>
                        <div className="space-y-2 text-sm">
                          <p>
                            <strong className="text-[#557C55]">
                              Type d'invitation :
                            </strong>{" "}
                            <span className="font-bold text-black">
                              {renderTypeLabel(invitationDetails?.type || null)}
                            </span>
                          </p>
                          <p className="flex items-center gap-2">
                            <strong className="text-[#557C55]">
                              Confirmée :
                            </strong>{" "}
                            {invitationDetails?.confirmed_at ? (
                              <span className="inline-block bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full text-xs border border-green-500">
                                ✓ Oui ·{" "}
                                {new Date(
                                  invitationDetails?.confirmed_at || "",
                                ).toLocaleDateString("fr-FR")}
                              </span>
                            ) : (
                              <span className="inline-block bg-red-100 text-red-800 font-bold px-3 py-1 rounded-full text-xs border border-red-500">
                                ✗ Non
                              </span>
                            )}
                          </p>
                          <p>
                            <strong className="text-[#557C55]">
                              Hébergement :
                            </strong>{" "}
                            <span className="font-bold text-black">
                              {invitationDetails?.hebergement === true
                                ? `Oui (${invitationDetails?.herbergement_nombre} personne(s))`
                                : "Non"}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div>
                        <h3
                          className="text-lg font-semibold text-[#557C55] mb-4"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          Régime alimentaire
                        </h3>
                        <div className="space-y-2 text-sm">
                          {invitationDetails?.regime && (
                            <p>
                              <strong className="text-[#557C55]">
                                Régime :
                              </strong>{" "}
                              <span className="font-bold text-black">
                                {invitationDetails?.regime}
                              </span>
                            </p>
                          )}
                          {invitationDetails?.allergie && (
                            <p>
                              <strong className="text-[#557C55]">
                                Allergies :
                              </strong>{" "}
                              <span className="font-bold text-black">
                                {invitationDetails?.allergie}
                              </span>
                            </p>
                          )}
                          {!invitationDetails?.allergie &&
                            !invitationDetails?.regime && <strong>RAS</strong>}
                        </div>
                      </div>
                    </div>

                    {/* Invités */}
                    <div>
                      <h3
                        className="text-lg font-semibold text-[#557C55] mb-4"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        Invités ({invitationDetails?.invites.length})
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-[#557C55]/20">
                            <tr>
                              <th className="px-4 py-2 text-left">Nom</th>
                              <th className="px-4 py-2 text-center font-bold">
                                Mairie
                              </th>
                              <th className="px-4 py-2 text-center">
                                Cocktail
                              </th>
                              <th className="px-4 py-2 text-center font-bold">
                                Château
                              </th>
                              <th className="px-4 py-2 text-center">Brunch</th>
                              <th className="px-4 py-2 text-center">IA</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#557C55]/10">
                            {invitationDetails?.invites.map((invite) => (
                              <tr key={invite.id}>
                                <td className="px-4 py-3">{invite.nom}</td>
                                <td className="px-4 py-3 text-center">
                                  {invite.mairie === true
                                    ? "✓"
                                    : invite.mairie === false
                                      ? "✗"
                                      : "-"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {invite.cocktail === true
                                    ? "✓"
                                    : invite.cocktail === false
                                      ? "✗"
                                      : "-"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {invite.chateau === true
                                    ? "✓"
                                    : invite.chateau === false
                                      ? "✗"
                                      : "-"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {invite.brunch === true ? "✓" : "✗"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {invite.autorisation_ia === true
                                    ? "✓"
                                    : invite.autorisation_ia === false
                                      ? "✗"
                                      : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Musique */}
                    {invitationDetails?.link_music && (
                      <div className="bg-[#557C55]/5 p-4 rounded-lg">
                        <h3
                          className="text-lg font-semibold text-[#557C55] mb-2"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          Chansons proposées
                        </h3>
                        <p className="text-sm whitespace-pre-wrap">
                          {invitationDetails?.link_music}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Modale des détails d'hébergement */}
        {accommodationModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#F9F6F0] rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-[#557C55] text-white p-6 flex justify-between items-center sticky top-0">
                <h2
                  className="text-2xl italic"
                  style={{ fontFamily: "'Dancing Script', cursive" }}
                >
                  Hébergement
                </h2>
                <button
                  onClick={() => setAccommodationModal(null)}
                  className="text-2xl cursor-pointer hover:scale-125 transition-transform"
                >
                  ✕
                </button>
              </div>

              <div className="p-8 space-y-4">
                {accommodationModal.invitations.length === 0 ? (
                  <p className="text-center text-slate-600 italic">
                    Aucune demande d'hébergement
                  </p>
                ) : (
                  <div className="space-y-3">
                    {accommodationModal.invitations.map((inv, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-4 bg-white/50 rounded-lg border border-green-200"
                      >
                        <div>
                          <p
                            className="font-semibold text-green-700"
                            style={{ fontFamily: "'Playfair Display', serif" }}
                          >
                            {inv.nom}
                          </p>
                          <p className="text-sm text-slate-600">
                            {inv.nombre} personne{inv.nombre > 1 ? "s" : ""}
                          </p>
                        </div>
                        <span className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full text-xs border border-green-500">
                          {inv.nombre}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modale des détails de stats */}
        {statsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#F9F6F0] rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-[#557C55] text-white p-6 flex justify-between items-center sticky top-0">
                <h2
                  className="text-2xl italic"
                  style={{ fontFamily: "'Dancing Script', cursive" }}
                >
                  {statsModal.type === "mairie" ? "MAIRIE" : "CHÂTEAU"} -{" "}
                  {statsModal.status === "accepted" ? "Confirmés" : "Refusés"}
                </h2>
                <button
                  onClick={() => setStatsModal(null)}
                  className="text-2xl cursor-pointer hover:scale-125 transition-transform"
                >
                  ✕
                </button>
              </div>

              <div className="p-8 space-y-4">
                {statsModal.people.length === 0 ? (
                  <p className="text-center text-slate-600 italic">
                    Aucune personne dans cette catégorie
                  </p>
                ) : (
                  <div className="space-y-3">
                    {statsModal.people.map((person, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-4 bg-white/50 rounded-lg border border-[#557C55]/20"
                      >
                        <div>
                          <p
                            className="font-semibold text-[#557C55]"
                            style={{ fontFamily: "'Playfair Display', serif" }}
                          >
                            {person.nom}
                          </p>
                          <p className="text-sm text-slate-600">
                            {person.invitationNom}
                          </p>
                        </div>
                        {statsModal.status === "accepted" ? (
                          <span className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full text-xs border border-green-500">
                            ✓ Confirmé
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-800 font-bold px-3 py-1 rounded-full text-xs border border-red-500">
                            ✗ Refusé
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
