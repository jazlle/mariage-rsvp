"use client";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F6F0]">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-semibold text-[#557C55]">
          Invitation introuvable
        </h1>
        <p className="text-lg text-gray-600">
          Le lien que vous avez utilisé n'est pas valide.
        </p>
        <p className="text-base text-gray-500">
          Veuillez vérifier votre lien ou bien nous recontacter.
        </p>
      </div>
    </div>
  );
}
