import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const DELTA_V2_INSTALL_URL =
  "itms-services://?action=download-manifest&url=https://cocox.wtf/api/manifest.plist";

export function DeltaV2InstallButton() {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          data-testid="button-delta-v2"
          className="w-full border border-red-500/50 bg-red-500/5 px-5 py-4 text-center transition-all hover:scale-[1.02] hover:bg-red-500/10 active:scale-[0.98]"
        >
          <span className="block font-display text-sm font-bold uppercase tracking-[0.12em] text-white">
            Delta Executor V2 (Working)
          </span>
          <span className="mt-2 block text-xs text-muted-foreground">
            Not Verified By CocoX
          </span>
          <span className="mt-1 block text-sm font-bold text-red-400">
            Try For Your Own Risk
          </span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent
        data-testid="dialog-delta-v2"
        overlayClassName="z-[110]"
        className="z-[120] max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto border-red-500/40 bg-[#100b09] text-white"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl">
            Are you sure?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-sm leading-relaxed text-neutral-300">
            <span className="block">
              This app was not made by CocoX. It is listed as Delta Working, but
              it has not been verified by me.
            </span>
            <span className="block font-bold text-red-400">
              Try For Your Own Risk
            </span>
            <span className="block">
              Press Install Anyway to continue.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            data-testid="button-cancel-delta-v2"
            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            asChild
            className="bg-red-600 text-white hover:bg-red-500"
          >
            <a href={DELTA_V2_INSTALL_URL} data-testid="link-install-delta-v2">
              Install Anyway
            </a>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
