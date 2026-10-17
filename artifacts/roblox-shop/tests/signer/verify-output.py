"""Independent ZIP, provisioning CMS, Mach-O CodeDirectory and signature checks."""
import hashlib
import pathlib
import plistlib
import struct
import subprocess
import sys
import zipfile


def verify(ipa, fixtures):
    with zipfile.ZipFile(ipa) as archive:
        assert archive.testzip() is None, "ZIP CRC failure/truncation"
        names = archive.namelist()
        assert len(names) == len(set(names)), "Duplicate ZIP entries"
        app = "Payload/Synthetic.app/"
        embedded = archive.read(app + "embedded.mobileprovision")
        assert embedded == (fixtures / "synthetic.mobileprovision").read_bytes()
        profile = subprocess.check_output([
            "openssl", "cms", "-verify", "-binary", "-inform", "DER", "-noverify",
            "-in", str(fixtures / "synthetic.mobileprovision")], stderr=subprocess.DEVNULL)
        assert plistlib.loads(profile)["Entitlements"]["application-identifier"] == "TESTTEAM01.test.synthetic"
        info = archive.read(app + "Info.plist")
        assert plistlib.loads(info)["CFBundleIdentifier"] == "test.synthetic"
        resource = archive.read(app + "resource.txt")
        assert resource == b"synthetic-resource-marker\n"
        resources = archive.read(app + "_CodeSignature/CodeResources")
        manifest = plistlib.loads(resources)
        assert manifest["files"]["resource.txt"] == hashlib.sha1(resource).digest()
        binary = archive.read(app + "Synthetic")

    assert struct.unpack_from("<I", binary)[0] == 0xfeedfacf
    pos, signature = 32, None
    for _ in range(struct.unpack_from("<I", binary, 16)[0]):
        cmd, size = struct.unpack_from("<II", binary, pos)
        assert size >= 8
        if cmd == 0x1d:
            offset, length = struct.unpack_from("<II", binary, pos + 8)
            assert offset + length <= len(binary), "Truncated code signature"
            signature = binary[offset:offset + length]
        pos += size
    assert signature, "Missing LC_CODE_SIGNATURE"
    magic, length, count = struct.unpack_from(">III", signature)
    assert magic == 0xfade0cc0 and length <= len(signature)
    blobs = {}
    for i in range(count):
        slot, offset = struct.unpack_from(">II", signature, 12 + 8 * i)
        blob_magic, blob_length = struct.unpack_from(">II", signature, offset)
        assert offset + blob_length <= length
        blobs[slot] = (blob_magic, signature[offset:offset + blob_length])
    assert 0 in blobs and 0x1000 in blobs, "Missing primary/alternate CodeDirectories"
    for cd_slot in [0, 0x1000]:
        cd_magic, cd = blobs[cd_slot]
        assert cd_magic == 0xfade0c02
        _, _, _, _, hash_offset, ident_offset, special_count, code_count, code_limit = struct.unpack_from(">9I", cd)
        hash_size, hash_type, _, page_power = struct.unpack_from("4B", cd, 36)
        digest = {1: hashlib.sha1, 2: hashlib.sha256, 3: hashlib.sha256, 4: hashlib.sha384}[hash_type]
        hash_of = lambda data: digest(data).digest()[:hash_size]
        assert cd[ident_offset:].split(b"\0")[0] == b"test.synthetic"
        page_size = 1 << page_power
        assert code_limit == offset_signature(binary), "Signature does not cover all executable bytes"
        assert code_count == (code_limit + page_size - 1) // page_size
        for i in range(code_count):
            assert cd[hash_offset + i * hash_size:hash_offset + (i + 1) * hash_size] == hash_of(
                binary[i * page_size:min((i + 1) * page_size, code_limit)]), "Code page hash mismatch"
        for slot, content in [(1, info), (2, blobs[2][1]), (3, resources), (5, blobs[5][1]), (7, blobs[7][1])]:
            assert special_count >= slot
            assert cd[hash_offset - slot * hash_size:hash_offset - (slot - 1) * hash_size] == hash_of(content), "Special slot hash mismatch"
    assert blobs[5][0] == 0xfade7171
    entitlements = plistlib.loads(blobs[5][1][8:])
    assert entitlements["application-identifier"] == "TESTTEAM01.test.synthetic"
    assert 0x10000 in blobs, f"Missing CMS signature; slots: {list(map(hex, blobs))}"
    assert blobs[0x10000][0] == 0xfade0b01, "Missing CMS signature"
    (fixtures / "signature.der").write_bytes(blobs[0x10000][1][8:])
    cd = blobs[0][1]
    (fixtures / "codedirectory.bin").write_bytes(cd)
    subprocess.run(["openssl", "cms", "-verify", "-binary", "-inform", "DER",
                    "-in", str(fixtures / "signature.der"), "-content",
                    str(fixtures / "codedirectory.bin"), "-noverify",
                    "-certfile", str(fixtures / "cert.pem"), "-nointern",
                    "-out", str(fixtures / "verified.bin")],
                   check=True, capture_output=True)
    assert (fixtures / "verified.bin").read_bytes() == cd
    print("ZIP, embedded profile, resource hashes, code hashes and CMS signature verified")


def offset_signature(binary):
    pos = 32
    for _ in range(struct.unpack_from("<I", binary, 16)[0]):
        cmd, size = struct.unpack_from("<II", binary, pos)
        if cmd == 0x1d:
            return struct.unpack_from("<I", binary, pos + 8)[0]
        pos += size
    raise AssertionError("Missing signature offset")


if __name__ == "__main__":
    verify(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
