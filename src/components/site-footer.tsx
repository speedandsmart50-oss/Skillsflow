import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-cyan-400/10 bg-[#070e1b]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div><div className="mb-3 text-lg font-semibold text-white">SkillFlow</div><p className="max-w-xs text-sm text-slate-400">Professional AI skill commerce for teams shipping with code assistants and automated workflows.</p></div>
        <div><h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-cyan-300">Marketplace</h3><div className="space-y-2 text-sm text-slate-400"><Link href="/shop" className="block hover:text-white">Shop</Link><Link href="/account" className="block hover:text-white">Client area</Link><Link href="/admin" className="block hover:text-white">Admin center</Link></div></div>
        <div><h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-cyan-300">Legal</h3><div className="space-y-2 text-sm text-slate-400"><Link href="/legal" className="block hover:text-white">Terms and conditions</Link><Link href="/legal" className="block hover:text-white">Privacy policy</Link></div></div>
      </div>
    </footer>
  );
}
