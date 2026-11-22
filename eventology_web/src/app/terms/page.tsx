import Link from "next/link";
import { Scale, ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="py-12 md:py-20 px-6 lg:px-8 space-y-12 max-w-4xl mx-auto">
      <div>
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-[#FFD700] hover:underline mb-4 font-mono">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Eventalogy International Home</span>
        </Link>
        <div className="flex items-center gap-2 text-xs font-bold text-[#FFD700] uppercase tracking-wider font-mono">
          <Scale className="h-4 w-4" />
          <span>Institutional Contractual Framework</span>
        </div>
        <h1 className="font-syne text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
          Terms of Service & Escrow Rules
        </h1>
        <p className="text-xs text-slate-400 font-mono mt-2">
          Applicable Jurisdiction: Raipur, Chhattisgarh, India • Eventalogy International Directorate
        </p>
      </div>

      <div className="space-y-8 text-sm text-slate-300 leading-relaxed border-t border-white/10 pt-8">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">1. Contractual Parties & Scope</h2>
          <p>
            By accessing or using the Eventalogy International web platform, mobile studio, or reverse auction tenders, you agree to be bound by these Terms of Service. These terms govern the relationship between Event Organizers (&ldquo;Clients&rdquo;), Technical Service Providers (&ldquo;Contractors&rdquo;), Property Owners (&ldquo;Venues&rdquo;), and Eventalogy International Solutions Pvt. Ltd.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">2. NBC 2016 Life Safety Compliance Guarantee</h2>
          <p>
            All spatial floorplans generated using Eventalogy International&apos;s Draw.io integration must strictly adhere to the National Building Code of India (NBC 2016 Part 4). Organizers agree not to obstruct designated egress corridors, emergency fire hose reels, or electrical switchgear zones. Any floorplan flagged with a structural or life-safety violation cannot proceed to milestone contract signing.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">3. 25/50/25 Milestone Escrow Governance</h2>
          <p>
            Production budgets tendered via Eventalogy International are locked in escrow and disbursed strictly according to verified operational milestones:
          </p>
          <ul className="space-y-2 pl-4">
            <li>• <strong className="text-white">Milestone 1 (25% Advance):</strong> Disbursed upon mutual digital signature and KYC confirmation.</li>
            <li>• <strong className="text-white">Milestone 2 (50% Handover):</strong> Disbursed upon loading dock QR scan, equipment inventory match, and soundcheck approval.</li>
            <li>• <strong className="text-white">Milestone 3 (25% Strike):</strong> Disbursed upon clean stage strike or 48-hour automated release.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">4. Arbitration & Jurisdiction</h2>
          <p>
            Any dispute arising out of or in connection with milestone releases or technical gear non-performance shall first be submitted to Eventalogy International Technical Arbitration. Legal proceedings shall fall under the exclusive jurisdiction of the courts of Raipur, Chhattisgarh, India.
          </p>
        </section>
      </div>
    </div>
  );
}
