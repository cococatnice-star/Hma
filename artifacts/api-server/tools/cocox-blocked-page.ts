// Self-contained browser homepage; no tracking, remote assets, or JavaScript.
export const blockedHomePage = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Blocked · CocoX Security</title>
<style>
*{box-sizing:border-box}
:root{color-scheme:dark}
body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;overflow-x:hidden;background:radial-gradient(ellipse at 50% 25%,#ff641222,transparent 60%),#08090c;color:#f8f8fa;font-family:system-ui,-apple-system,sans-serif}
body::before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(#ffffff05 1px,transparent 1px),linear-gradient(90deg,#ffffff05 1px,transparent 1px);background-size:48px 48px}
main{position:relative;width:min(100%,510px);padding:clamp(28px,7vw,52px);text-align:center;border:1px solid #ff782f55;border-radius:28px;background:linear-gradient(145deg,#17171e,#0d0e13);box-shadow:0 24px 100px #0009,0 0 60px #ff671210;animation:enter .7s ease-out both}
.brand{margin-bottom:36px;color:#ff964f;font:700 11px ui-monospace,monospace;letter-spacing:4px;text-transform:uppercase}
.shield{display:grid;place-items:center;width:96px;height:96px;margin:0 auto 28px;border:1px solid #ff7c3744;border-radius:28px;background:#ff762510;box-shadow:0 0 40px #ff762515;animation:float 4s ease-in-out infinite}
svg{width:46px;height:46px;fill:none;stroke:#ff965b;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.status{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid #ff696933;border-radius:30px;background:#ff474710;color:#ff8585;font:600 10px ui-monospace,monospace;letter-spacing:2px}
.status::before{content:"";width:6px;height:6px;border-radius:50%;background:#ff7979;box-shadow:0 0 12px #ff7979}
h1{margin:22px 0 16px;font-size:clamp(30px,8vw,43px);line-height:1.12;letter-spacing:-1.6px}
h1 span{color:#ff9859}
p{margin:0;color:#a6a7b4;font-size:14px;line-height:1.8}
footer{margin-top:34px;padding-top:22px;border-top:1px solid #ffffff0b;color:#727582;font:10px ui-monospace,monospace;letter-spacing:2px}
@keyframes enter{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes float{50%{transform:translateY(-7px)}}
@media(prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
</head>
<body>
<main aria-labelledby="title">
  <div class="brand">CocoX Security</div>
  <div class="shield" aria-hidden="true">
    <svg viewBox="0 0 48 48">
      <path d="M24 4 40 10v12c0 11-16 21-16 21S8 33 8 22V10Z"/>
      <rect x="17" y="21" width="14" height="11" rx="3"/>
      <path d="M20 21v-4a4 4 0 0 1 8 0v4"/>
      <path d="M24 25v3"/>
    </svg>
  </div>
  <div class="status">ACCESS DENIED · 403</div>
  <h1 id="title">You have been<br><span>blocked.</span></h1>
  <p>CocoX Security has restricted access<br>to this website.</p>
  <footer>PROTECTED BY COCOX SECURITY</footer>
</main>
</body>
</html>`;
