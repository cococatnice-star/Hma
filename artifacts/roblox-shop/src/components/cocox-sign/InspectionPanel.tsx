import { Loader2, ShieldAlert } from "lucide-react";
import type { SigningInspection } from "@/lib/cocox-inspection";

const formatDate = (value?: string) => value ? new Date(value).toLocaleString() : "Unknown";

export function InspectionPanel({ report, inspecting, acknowledge, onAcknowledge, disabled, canAcknowledge }: {
  report: SigningInspection | null;
  inspecting: boolean;
  acknowledge: boolean;
  onAcknowledge: (checked: boolean) => void;
  disabled: boolean;
  canAcknowledge: boolean;
}) {
  return (
    <section data-testid="inspection-panel" className="mb-6 rounded-[18px] border border-[#ff6a00]/15 bg-[#22130a] p-4 text-[13px] leading-relaxed">
      <h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-[#ff9a4a]">
        <ShieldAlert className="h-4 w-4" /> Local certificate &amp; profile inspection
      </h3>
      <div aria-live="polite" aria-busy={inspecting}>
        {inspecting ? <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Inspecting on this device…</p> : !report ? (
          <p>Add a certificate and profile to inspect their metadata.</p>
        ) : (
          <div className="space-y-2 break-words text-[#e8c8ad]">
            {report.certificate && <p data-testid="inspection-certificate"><strong>{report.certificate.name}</strong><br />
              Certificate expires: {formatDate(report.certificate.expires)}
              {report.certificate.team && <><br />Certificate team: {report.certificate.team}</>}
            </p>}
            {report.profile && <p data-testid="inspection-profile"><strong>{report.profile.name}</strong><br />
              Profile expires: {formatDate(report.profile.expires)}<br />
              Profile teams: {report.profile.teams.join(", ") || "Unknown"}<br />
              App-ID coverage: {report.profile.applicationId || "Unknown"}<br />
              {report.profile.distribution}
              {report.profile.deviceCount > 0 && <> ({report.profile.deviceCount} listed {report.profile.deviceCount === 1 ? "device" : "devices"})</>}
            </p>}
            {report.bundleIds.length > 0 && <p data-testid="inspection-bundles">App bundle IDs: {report.bundleIds.join(", ")}</p>}
            {report.certificateMatch !== undefined && <p data-testid="inspection-match">
              Certificate in profile: {report.certificateMatch ? "Matches the selected certificate" : "Does not match"}
            </p>}
            {report.warnings.length > 0 ? (
              <div className="rounded-[12px] border border-[#ffb27a]/25 bg-[#ffb27a]/[0.08] p-3 text-[#ffdcc0]">
                <p className="font-semibold">Warnings before signing</p>
                <ul data-testid="inspection-warnings" className="mt-1 list-disc space-y-1 pl-5">
                  {report.warnings.map((warning, i) => <li key={i}>{warning}</li>)}
                </ul>
                {canAcknowledge && <label className="mt-3 flex cursor-pointer items-start gap-2">
                  <input type="checkbox" data-testid="checkbox-inspection-warnings" checked={acknowledge}
                    disabled={disabled} onChange={e => onAcknowledge(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#ff6a00]" />
                  <span>I understand these warnings and want to attempt signing anyway.</span>
                </label>}
              </div>
            ) : <p>No issues found in the metadata inspected. This is not an installation approval.</p>}
          </div>
        )}
      </div>
      <p className="mt-3 text-[12px] text-[#a7826a]">Inspection stays on-device; your private keys, standalone profile and password are never uploaded or saved. Dates use your device clock. Offline metadata checks do not verify Apple revocation status, trust, or installation eligibility. The profile’s Apple signature is not verified here.</p>
    </section>
  );
}
