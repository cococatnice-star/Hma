import forge from "node-forge";
import { parse, parseBinary } from "plist";
import { DOMParser } from "@xmldom/xmldom";
import { BlobReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js";

export interface InspectionInputs {
  ipa: File | null;
  p12: File | null;
  profile: File | null;
  password: string;
}

export interface SigningInspection {
  certificate?: { name: string; expires: string; team?: string };
  profile?: {
    name: string; expires?: string; applicationId?: string; teams: string[];
    distribution: string; deviceCount: number;
  };
  bundleIds: string[];
  certificateMatch?: boolean;
  warnings: string[];
}

const MAX_METADATA = 2 * 1024 * 1024;
const binary = (bytes: Uint8Array) => {
  let value = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    value += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return value;
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Not a dictionary");
  return value as Record<string, unknown>;
};
const strings = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
const text = (value: unknown) => typeof value === "string" && value.length ? value : undefined;
const date = (value: unknown) => {
  const d = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  return d && Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
};

class QuietDOMParser extends DOMParser {
  constructor() {
    super({ onError: () => { throw new Error("Invalid profile XML"); } });
  }
}

function plist(bytes: Uint8Array) {
  if (bytes.length > MAX_METADATA) throw new Error("Metadata too large");
  if (new TextDecoder().decode(bytes.subarray(0, 8)) === "bplist00") return record(parseBinary(bytes));
  // The browser build of plist uses DOMParser, which workers do not provide.
  // Supply a local XML parser; it never resolves external DTDs or makes requests.
  const scope = globalThis as unknown as { DOMParser: typeof DOMParser };
  scope.DOMParser ??= QuietDOMParser;
  return record(parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
}

function cmsPayload(bytes: Uint8Array) {
  const children = (node: forge.asn1.Asn1) => {
    if (!node.constructed || !Array.isArray(node.value)) throw new Error("Invalid CMS structure");
    return node.value;
  };
  const oid = (node: forge.asn1.Asn1, expected: string) => {
    if (node.type !== forge.asn1.Type.OID || typeof node.value !== "string" ||
      forge.asn1.derToOid(node.value) !== expected) throw new Error("Unexpected CMS content type");
  };
  const root = children(forge.asn1.fromDer(binary(bytes)));
  oid(root[0], forge.pki.oids.signedData);
  const signedData = children(children(root[1])[0]);
  const encapsulated = children(signedData[2]);
  oid(encapsulated[0], forge.pki.oids.data);
  const octets = (node: forge.asn1.Asn1): string => {
    if (node.type !== forge.asn1.Type.OCTETSTRING) throw new Error("Not CMS octets");
    return node.constructed ? children(node).map(octets).join("") : typeof node.value === "string" ? node.value : "";
  };
  const payload = octets(children(encapsulated[1])[0]);
  if (!payload) throw new Error("Empty CMS payload");
  return Uint8Array.from(payload, c => c.charCodeAt(0));
}

function warnDates(label: string, expires: string | undefined, starts: string | undefined, warnings: string[], now: number) {
  if (!expires) warnings.push(`${label} expiration could not be read.`);
  else if (Date.parse(expires) <= now) warnings.push(`${label} has expired.`);
  else if (Date.parse(expires) - now < 7 * 86400000) warnings.push(`${label} expires within 7 days.`);
  if (starts && Date.parse(starts) > now) warnings.push(`${label} is not yet valid according to this device's clock.`);
}

export function coversBundleId(applicationId: string, prefixes: string[], bundleId: string) {
  const prefix = prefixes.find(p => applicationId.startsWith(`${p}.`));
  if (!prefix) return undefined;
  const pattern = applicationId.slice(prefix.length + 1);
  if (pattern === "*") return true;
  if (pattern.endsWith(".*") && !pattern.slice(0, -1).includes("*")) {
    return bundleId.startsWith(pattern.slice(0, -1)) && bundleId.length > pattern.length - 1;
  }
  if (pattern.includes("*")) return undefined;
  return pattern === bundleId;
}

async function appBundleIds(ipa: File) {
  const reader = new ZipReader(new BlobReader(ipa), { useWebWorkers: false });
  try {
    const entries = [];
    for await (const entry of reader.getEntriesGenerator()) {
      entries.push(entry);
      if (entries.length > 100_000) throw new Error("Too many archive entries");
    }
    const mains = entries.filter(e => !e.directory && /^Payload\/[^/]+\.app\/Info\.plist$/.test(e.filename));
    if (mains.length !== 1) throw new Error("Expected one app");
    const root = mains[0].filename.slice(0, -"Info.plist".length);
    const infos = entries.filter(e => e === mains[0] ||
      (e.filename.startsWith(root) && /\/[^/]+\.(appex|app)\/Info\.plist$/.test(e.filename)));
    const ids: string[] = [];
    for (const info of infos) {
      if (info.directory || info.uncompressedSize > MAX_METADATA || !info.getData) throw new Error("Invalid app metadata");
      const bytes = await info.getData(new Uint8ArrayWriter(), { useWebWorkers: false });
      const id = text(plist(bytes).CFBundleIdentifier);
      if (!id) throw new Error("Missing bundle ID");
      ids.push(id);
    }
    return [...new Set(ids)];
  } finally {
    await reader.close();
  }
}

/** Only non-secret summaries leave the inspection worker. No fetch, uploads or persistence. */
export async function inspectSigningInputs(inputs: InspectionInputs, now = Date.now()): Promise<SigningInspection> {
  const result: SigningInspection = { warnings: [], bundleIds: [] };
  let certDer: string | undefined;
  let developerCerts: string[] | undefined;
  let prefixes: string[] = [];
  if (inputs.p12) {
    try {
      if (inputs.p12.size > MAX_METADATA) throw new Error("Certificate too large");
      const pfx = forge.pkcs12.pkcs12FromAsn1(
        forge.asn1.fromDer(binary(new Uint8Array(await inputs.p12.arrayBuffer()))), false, inputs.password,
      );
      const bags = (oid: string) => pfx.getBags({ bagType: oid })[oid] ?? [];
      const keys = [...bags(forge.pki.oids.pkcs8ShroudedKeyBag), ...bags(forge.pki.oids.keyBag)]
        .flatMap(b => b.key ? [b.key] : []);
      const certs = bags(forge.pki.oids.certBag).flatMap(b => b.cert ? [b.cert] : []);
      // Select the identity by its actual RSA key, not by certificate bag order.
      const identities = certs.filter(c => keys.some(k => {
        const publicKey = c.publicKey as forge.pki.rsa.PublicKey;
        return k.n && publicKey.n && k.n.equals(publicKey.n) && k.e.equals(publicKey.e);
      }));
      if (identities.length !== 1) throw new Error("Ambiguous or unsupported signing identity");
      const cert = identities[0];
      certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
      result.certificate = {
        name: String(cert.subject.getField("CN")?.value || "Signing certificate"),
        team: text(cert.subject.getField("OU")?.value),
        expires: cert.validity.notAfter.toISOString(),
      };
      warnDates("Certificate", result.certificate.expires, cert.validity.notBefore.toISOString(), result.warnings, now);
    } catch {
      result.warnings.push("Certificate could not be inspected. Check its password and format; unsupported or ambiguous identities cannot be checked locally.");
    }
  }
  if (inputs.profile) {
    try {
      if (inputs.profile.size > MAX_METADATA) throw new Error("Profile too large");
      const bytes = new Uint8Array(await inputs.profile.arrayBuffer());
      // Decode the CMS payload structurally, not by searching for an XML fragment.
      const data = plist(cmsPayload(bytes));
      const entitlements = record(data.Entitlements);
      const devices = strings(data.ProvisionedDevices);
      result.profile = {
        name: text(data.Name) || "Provisioning profile",
        expires: date(data.ExpirationDate),
        applicationId: text(entitlements["application-identifier"]),
        teams: strings(data.TeamIdentifier),
        distribution: data.ProvisionsAllDevices === true ? "All devices (enterprise profile)"
          : devices.length ? `${entitlements["get-task-allow"] === true ? "Development" : "Ad hoc"} — listed devices only`
          : "No listed devices — may be App Store distribution; not direct device installation",
        deviceCount: devices.length,
      };
      prefixes = strings(data.ApplicationIdentifierPrefix);
      warnDates("Provisioning profile", result.profile.expires, date(data.CreationDate), result.warnings, now);
      if (!result.profile.applicationId || !prefixes.length) result.warnings.push("Profile app-ID coverage could not be read.");
      if (!devices.length && data.ProvisionsAllDevices !== true) result.warnings.push("This profile lists no devices and does not provision all devices. Direct installation eligibility cannot be confirmed.");
      if (devices.length) result.warnings.push("This profile covers only its listed devices. CocoX Sign cannot check whether your device is on that list.");
      if (!Array.isArray(data.DeveloperCertificates) || !data.DeveloperCertificates.length) {
        result.warnings.push("Profile contains no readable developer certificates; certificate matching cannot be checked.");
      } else {
        developerCerts = data.DeveloperCertificates.map(value => {
          if (!(value instanceof Uint8Array)) throw new Error("Invalid developer certificate");
          return binary(value);
        });
      }
    } catch {
      result.profile = undefined;
      developerCerts = undefined;
      result.warnings.push("Provisioning profile could not be inspected. It may be damaged or use an unsupported format.");
    }
  }
  if (certDer && developerCerts) {
    result.certificateMatch = developerCerts.includes(certDer);
    if (!result.certificateMatch) result.warnings.push("Certificate/profile mismatch: the selected signing certificate is not included in this profile.");
  }
  if (result.certificate?.team && result.profile?.teams.length &&
    !result.profile.teams.includes(result.certificate.team)) {
    result.warnings.push("Team mismatch: the certificate's team does not match the provisioning profile.");
  }
  if (inputs.ipa) {
    try {
      result.bundleIds = await appBundleIds(inputs.ipa);
      if (result.profile?.applicationId) {
        for (const id of result.bundleIds) {
          const covered = coversBundleId(result.profile.applicationId, prefixes, id);
          if (covered === false) result.warnings.push(`Profile does not cover app bundle ID ${id}. Embedded apps/extensions may require their own profiles.`);
          if (covered === undefined) result.warnings.push(`Profile coverage for ${id} could not be determined.`);
        }
      }
    } catch {
      result.warnings.push("App bundle IDs could not be inspected. Profile coverage for this IPA is unknown.");
    }
  }
  return result;
}
