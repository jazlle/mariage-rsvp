"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import sha256 from "crypto-js/sha256";

export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    const hashedPassword = sha256(password).toString();
    console.log("Hashed password:", hashedPassword);
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Fetch admin from database
      const { data: admin, error: dbError } = await supabase
        .from("admin")
        .select("id, login, password")
        .eq("login", login)
        .single();

      if (dbError || !admin) {
        setError("Login ou mot de passe incorrect.");
        setLoading(false);
        return;
      }

      // 2. Hash the entered password and compare
      const hashedPassword = sha256(password).toString();
      console.log("Hashed password:", hashedPassword);

      if (hashedPassword !== admin.password) {
        setError("Login ou mot de passe incorrect.");
        setLoading(false);
        return;
      }

      // 3. Store auth token in localStorage
      const authToken = sha256(`${admin.id}-${Date.now()}`).toString();
      localStorage.setItem("adminToken", authToken);
      localStorage.setItem("adminId", admin.id);

      // 4. Redirect to dashboard
      router.push("/admin/dashboard");
    } catch (err) {
      console.error(err);
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="bg-white/50 backdrop-blur-sm p-8 rounded-3xl border border-[#557C55]/20 shadow-sm">
          <h1
            className="text-4xl text-[#557C55] mb-2 text-center"
            style={{ fontFamily: "'Dancing Script', cursive" }}
          >
            Administration
          </h1>
          <p
            className="text-center text-slate-600 mb-8"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Accès réservé
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                className="block text-lg mb-2 italic"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Login
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-[#557C55]/30 focus:ring-0 focus:border-[#557C55] px-0 py-2"
                disabled={loading}
              />
            </div>

            <div>
              <label
                className="block text-lg mb-2 italic"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-[#557C55]/30 focus:ring-0 focus:border-[#557C55] px-0 py-2"
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-red-600 text-center text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#557C55] text-white py-3 rounded-full font-semibold hover:bg-[#557C55]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer italic"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {loading ? "Connexion en cours..." : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
