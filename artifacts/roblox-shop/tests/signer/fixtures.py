"""Disposable, non-installable signing fixtures. Never uses developer credentials."""
import datetime
import copy
import pathlib
import plistlib
import secrets
import struct
import subprocess
import sys
import zipfile


def openssl(*args):
    subprocess.run(["openssl", *map(str, args)], check=True, capture_output=True)


def macho():
    # Synthetic arm64 MH_EXECUTE with room for zsign's LC_CODE_SIGNATURE.
    # It contains no executable app code and cannot be installed as a real app.
    segment = lambda name, vmaddr, vmsize, offset, size: struct.pack(
        "<II16sQQQQIIII", 0x19, 72, name.encode(), vmaddr, vmsize,
        offset, size, 7, 5, 0, 0)
    text = bytearray(segment("__TEXT", 0x100000000, 4096, 0, 4096))
    struct.pack_into("<I", text, 4, 152)  # segment plus one section_64
    struct.pack_into("<I", text, 64, 1)
    section = struct.pack("<16s16sQQIIIIIIII", b"__text", b"__TEXT",
                          0x100000400, 3072, 1024, 2, 0, 0, 0x80000400, 0, 0, 0)
    commands = bytes(text) + section
    commands += segment("__LINKEDIT", 0x100001000, 0, 4096, 0)
    commands += struct.pack("<IIQQ", 0x80000028, 24, 512, 0)  # LC_MAIN
    header = struct.pack("<IIIIIIII", 0xfeedfacf, 0x100000c, 0, 2, 3,
                         len(commands), 0x200085, 0)
    return (header + commands).ljust(4096, b"\0")


def generate(root):
    root.mkdir(parents=True, exist_ok=True)
    root.chmod(0o700)
    key, cert = root / "key.pem", root / "cert.pem"
    # zsign selects its CMS chain by issuer-name hash. Use a synthetic,
    # self-signed authority with the expected public DN, never Apple's key.
    # The leaf is explicitly synthetic; OpenSSL verification below bypasses
    # trust-chain validation but still verifies its actual cryptographic signature.
    ca_key, ca_cert = root / "ca-key.pem", root / "ca.pem"
    openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2",
            "-subj", "/CN=Apple Worldwide Developer Relations Certification Authority/OU=G3/O=Apple Inc./C=US",
            "-keyout", ca_key, "-out", ca_cert)
    issuer_hash = subprocess.check_output(["openssl", "x509", "-in", str(ca_cert),
                                          "-subject_hash", "-noout"]).strip()
    assert issuer_hash == b"9b16b75c", "Unexpected synthetic issuer DN encoding"
    openssl("req", "-new", "-newkey", "rsa:2048", "-nodes",
            "-subj", "/CN=Synthetic Regression Only/OU=TESTTEAM01",
            "-keyout", key, "-out", root / "leaf.csr")
    openssl("x509", "-req", "-in", root / "leaf.csr", "-CA", ca_cert,
            "-CAkey", ca_key, "-set_serial", "123456", "-days", "2", "-out", cert)
    for filename, password in [("blank.p12", ""), ("protected.p12", "synthetic-password")]:
        openssl("pkcs12", "-export", "-inkey", key, "-in", cert,
                "-out", root / filename, "-passout", "pass:" + password)
    der = subprocess.check_output(["openssl", "x509", "-in", str(cert),
                                   "-outform", "DER"])
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    profile = {
        "Name": "Synthetic regression only", "UUID": "11111111-2222-3333-4444-555555555555",
        "TeamIdentifier": ["TESTTEAM01"], "ApplicationIdentifierPrefix": ["TESTTEAM01"],
        "CreationDate": now, "ExpirationDate": now + datetime.timedelta(days=2),
        "DeveloperCertificates": [der], "ProvisionedDevices": ["0" * 40],
        "Entitlements": {"application-identifier": "TESTTEAM01.test.synthetic",
                         "com.apple.developer.team-identifier": "TESTTEAM01",
                         "get-task-allow": True},
    }
    (root / "profile.plist").write_bytes(plistlib.dumps(profile))
    openssl("cms", "-sign", "-binary", "-nodetach", "-in", root / "profile.plist",
            "-signer", cert, "-inkey", key, "-outform", "DER",
            "-out", root / "synthetic.mobileprovision")
    # Metadata-only variations, always signed by the disposable synthetic identity.
    def profile_variant(name, modify, binary=False):
        variant = copy.deepcopy(profile)
        modify(variant)
        source = root / f"{name}.plist"
        source.write_bytes(plistlib.dumps(variant, fmt=plistlib.FMT_BINARY if binary else plistlib.FMT_XML))
        openssl("cms", "-sign", "-binary", "-nodetach", "-in", source,
                "-signer", cert, "-inkey", key, "-outform", "DER",
                "-out", root / f"{name}.mobileprovision")

    profile_variant("expired", lambda p: p.update(ExpirationDate=now - datetime.timedelta(days=1)))
    profile_variant("wrong-bundle", lambda p: p["Entitlements"].update({"application-identifier": "TESTTEAM01.other.app"}))
    profile_variant("wildcard", lambda p: p["Entitlements"].update({"application-identifier": "TESTTEAM01.test.*"}), binary=True)
    profile_variant("wrong-team", lambda p: p.update(TeamIdentifier=["OTHERTEAM1"]))
    profile_variant("no-devices", lambda p: p.pop("ProvisionedDevices"))
    profile_variant("missing-dates", lambda p: p.pop("ExpirationDate"))
    openssl("x509", "-req", "-in", root / "leaf.csr", "-CA", ca_cert,
            "-CAkey", ca_key, "-set_serial", "234567", "-days", "-1", "-out", root / "expired.pem")
    openssl("pkcs12", "-export", "-inkey", key, "-in", root / "expired.pem",
            "-out", root / "expired.p12", "-passout", "pass:")
    openssl("x509", "-req", "-in", root / "leaf.csr", "-CA", ca_cert,
            "-CAkey", ca_key, "-set_serial", "345678", "-days", "30", "-out", root / "different.pem")
    different_der = subprocess.check_output(["openssl", "x509", "-in", str(root / "different.pem"), "-outform", "DER"])
    profile_variant("mismatch", lambda p: p.update(DeveloperCertificates=[different_der]))
    (root / "damaged.mobileprovision").write_bytes(b"not a CMS profile")
    info = plistlib.dumps({
        "CFBundleIdentifier": "test.synthetic", "CFBundleExecutable": "Synthetic",
        "CFBundleName": "Synthetic", "CFBundleVersion": "1",
        "CFBundleShortVersionString": "1.0", "CFBundlePackageType": "APPL",
    })
    for name, large in [("small.ipa", False), ("long.ipa", True)]:
        with zipfile.ZipFile(root / name, "w", zipfile.ZIP_STORED) as archive:
            archive.writestr("Payload/Synthetic.app/Info.plist", info)
            archive.writestr("Payload/Synthetic.app/Synthetic", macho())
            archive.writestr("Payload/Synthetic.app/resource.txt", b"synthetic-resource-marker\n")
            if large:
                # Uncompressible resources ensure cancellation occurs during real work.
                for i in range(32):
                    archive.writestr(f"Payload/Synthetic.app/assets/{i}.bin",
                                     secrets.token_bytes(1024 * 1024))
    with zipfile.ZipFile(root / "binary.ipa", "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("Payload/Synthetic.app/Info.plist", plistlib.dumps(plistlib.loads(info), fmt=plistlib.FMT_BINARY))
        archive.writestr("Payload/Synthetic.app/Synthetic", macho())
    (root / "broken.ipa").write_bytes(b"not a ZIP archive")
    for path in root.iterdir():
        path.chmod(0o600)


if __name__ == "__main__":
    generate(pathlib.Path(sys.argv[1]))
