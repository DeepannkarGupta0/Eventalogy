import Link from "next/link";
import { ShieldCheck, Lock, FileText, ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="py-12 md:py-20 px-6 lg:px-8 space-y-12 max-w-4xl mx-auto">
      <div>
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-[#FFD700] hover:underline mb-4 font-mono">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Eventalogy International Home</span>
        </Link>
        <div className="flex items-center gap-2 text-xs font-bold text-[#10B981] uppercase tracking-wider font-mono">
          <ShieldCheck className="h-4 w-4" />
          <span>Institutional Data Governance</span>
        </div>
        <h1 className="font-syne text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
          Privacy Policy
        </h1>
        <p className="text-xs text-slate-400 font-mono mt-2">
          Effective Date: November 22, 2026 • Eventalogy International Directorate
        </p>
      </div>

      <div className="space-y-8 text-sm text-slate-300 leading-relaxed border-t border-white/10 pt-8">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">1. Data Architecture & Scope</h2>
          <p>
            Eventalogy International Solutions Pvt. Ltd. (&ldquo;Eventalogy International&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates a deterministic event engineering platform and marketplace. This Privacy Policy outlines how we collect, verify, process, and protect architectural blueprints, financial billing information, and institutional KYC credentials submitted by clients, venue owners, and technical contractors.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">2. Architectural Blueprints & Spatial Assets</h2>
          <p>
            Blueprints, CAD floorplans, and site photos uploaded to the Eventalogy International Spatial Engine (OpenCV Vectorizer and NBC 2016 safety checker) are treated as strictly confidential commercial assets. Vectorized geometries are processed in private memory environments and are never sold or shared with unauthorized third parties.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">3. KYC Documents & Identity Verification</h2>
          <p>
            In compliance with international commercial regulations and anti-money laundering standards, contractors submitting bids to the reverse auction pool must complete 5-Tier KYC verification (including GSTIN, PAN, FSSAI licenses, and certified electrician credentials). KYC data is stored using bank-grade AES-256 encryption.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">4. Milestone Escrow & Financial Records</h2>
          <p>
            Eventalogy International maintains double-entry transaction ledgers for all 25/50/25 milestone escrow payments. Escrow funds are managed via RBI-regulated scheduled banking partners. We do not store raw credit card numbers or UPI PINs on our servers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">5. Contact Data Privacy Officer</h2>
          <p>
            For inquiries regarding data retention, rectification, or architectural asset deletion, contact our Data Privacy Officer at <span className="text-[#FFD700] font-mono">legal@eventalogy.in</span> or call <span className="text-white font-mono">+91 771 400 9000</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
