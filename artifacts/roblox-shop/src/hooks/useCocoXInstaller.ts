import { useCallback, useEffect, useRef, useState } from "react";
import { useCreateCocoXInstall, useCompleteCocoXInstall, useDeleteCocoXInstall } from "@workspace/api-client-react";
import type { SignedIpa } from "./useCocoXSigner";

type Phase = "idle" | "uploading" | "preparing" | "ready" | "error";

function errorMessage(error: unknown) {
  const value = error as { data?: { error?: string }; message?: string };
  return value?.data?.error || value?.message || "Installation preparation failed. Your signed IPA is still available to download.";
}

export function useCocoXInstaller() {
  const { mutateAsync: createUpload } = useCreateCocoXInstall();
  const { mutateAsync: completeUpload } = useCompleteCocoXInstall();
  const { mutateAsync: deleteUpload } = useDeleteCocoXInstall();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [installUrl, setInstallUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const generation = useRef(0);
  const request = useRef<XMLHttpRequest | null>(null);
  const allocatedId = useRef("");

  const clear = useCallback(() => {
    generation.current++;
    request.current?.abort();
    request.current = null;
    allocatedId.current = "";
    setPhase("idle");
    setError(""); setProgress(0); setInstallUrl(""); setExpiresAt("");
    // A discarded hosted link remains subject to its expiry and cleanup.
    // The explicit revoke action below removes an allocated hosted copy.
  }, []);

  useEffect(() => () => {
    generation.current++;
    request.current?.abort();
  }, []);

  const prepare = useCallback(async (result: SignedIpa): Promise<string | null> => {
    const current = ++generation.current;
    request.current?.abort();
    setPhase("uploading"); setError(""); setInstallUrl(""); setProgress(0);
    try {
      const { bundleId, version, title } = result.metadata || {};
      if (!bundleId || !version || !title) {
        throw new Error("The signing engine did not provide the app's bundle details. Download the IPA instead.");
      }
      if (result.blob.size > 500 * 1024 * 1024) {
        throw new Error("Hosted installation supports signed IPAs up to 500 MB. You can still download this file.");
      }
      const upload = await createUpload({ data: { name: result.name, size: result.blob.size, bundleId, version, title } });
      if (current !== generation.current) {
        await deleteUpload({ id: upload.id }).catch(() => {});
        return null;
      }
      allocatedId.current = upload.id;
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        request.current = xhr;
        xhr.open("PUT", upload.uploadUrl);
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.upload.onprogress = event => {
          if (current === generation.current && event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100));
        };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The signed IPA upload was rejected. Try again or download the local file."));
        xhr.onerror = () => reject(new Error("The signed IPA upload failed. Check your connection or download the local file."));
        xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
        xhr.send(result.blob); // Only the newly signed IPA, never the P12 or password.
      });
      if (current !== generation.current) return null;
      request.current = null;
      setPhase("preparing");
      const ready = await completeUpload({ id: upload.id });
      if (current !== generation.current) return null;
      setInstallUrl(ready.installUrl); setExpiresAt(ready.expiresAt);
      setPhase("ready");
      return ready.installUrl;
    } catch (failure) {
      if (current !== generation.current) return null;
      request.current = null;
      setError(errorMessage(failure)); setPhase("error");
      return null;
    }
  }, [createUpload, completeUpload, deleteUpload]);

  const revoke = useCallback(async () => {
    const id = allocatedId.current;
    if (!id) { clear(); return; }
    request.current?.abort();
    generation.current++;
    try {
      await deleteUpload({ id });
      clear();
    } catch (failure) {
      setError(errorMessage(failure));
      setPhase("error");
    }
  }, [deleteUpload, clear]);

  return { phase, progress, error, installUrl, expiresAt, prepare, clear, revoke,
    busy: phase === "uploading" || phase === "preparing" };
}
