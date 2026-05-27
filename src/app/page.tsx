import Link from "next/link";
import { LogoMark } from "@/components/logo";

export default function Home() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-cream via-cream to-paper">
      <div className="mx-auto max-w-sm px-7 py-10 flex flex-col min-h-dvh">
        {/* ── Header ── */}
        <header className="flex items-center gap-3">
          <LogoMark className="w-9 h-9 shrink-0" />
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill">
            For STR Hosts&nbsp;&amp;&nbsp;Operators
          </span>
        </header>

        {/* ── Chalk rule ── */}
        <hr className="border-chalk mt-6 mb-8" />

        {/* ── Eyebrow ── */}
        <div className="flex items-center gap-3 mb-6">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill whitespace-nowrap">
            № 01&nbsp;&middot;&nbsp;The Cover
          </span>
          <span className="flex-1 h-px bg-tangerine" />
        </div>

        {/* ── Headline ── */}
        <h1 className="font-serif text-[64px] font-normal leading-[0.94] tracking-[-3px] text-plum mb-5">
          Time, made{" "}
          <em className="text-tangerine italic">visible.</em>
        </h1>

        {/* ── Deck ── */}
        <p className="font-serif italic text-[17px] leading-relaxed text-quill mb-10">
          A quiet, meticulous time-tracker built for short-term-rental hosts who
          need to prove material participation to the IRS.
        </p>

        {/* ── Promises ── */}
        <ol className="border-t border-b border-chalk divide-y divide-chalk mb-10">
          <li className="py-4 flex gap-4">
            <span className="font-mono text-[11px] text-tangerine mt-0.5">01</span>
            <div>
              <p className="font-medium text-[15px] text-plum leading-snug">
                Pass the IRS tests.
              </p>
              <p className="text-[13px] text-slate mt-0.5 leading-snug">
                Material-participation tracking mapped to all seven tests.
              </p>
            </div>
          </li>
          <li className="py-4 flex gap-4">
            <span className="font-mono text-[11px] text-tangerine mt-0.5">02</span>
            <div>
              <p className="font-medium text-[15px] text-plum leading-snug">
                Audit-ready exports.
              </p>
              <p className="text-[13px] text-slate mt-0.5 leading-snug">
                One-tap PDF and CSV reports your CPA will love.
              </p>
            </div>
          </li>
          <li className="py-4 flex gap-4">
            <span className="font-mono text-[11px] text-tangerine mt-0.5">03</span>
            <div>
              <p className="font-medium text-[15px] text-plum leading-snug">
                Two-tap logging.
              </p>
              <p className="text-[13px] text-slate mt-0.5 leading-snug">
                Start a timer or add an entry in under two seconds.
              </p>
            </div>
          </li>
        </ol>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Footer CTA ── */}
        <div className="flex flex-col gap-3 mb-4">
          <Link
            href="/signup"
            className="btn--full flex items-center justify-center w-full bg-plum text-cream hover:bg-plum-deep min-h-12 px-5.5 py-3.5 rounded-md font-medium text-[15px] transition-colors"
          >
            Start free
          </Link>
          <Link
            href="/login"
            className="btn--full flex items-center justify-center w-full bg-transparent text-plum border border-chalk hover:border-plum min-h-12 px-5.5 py-3.5 rounded-md font-medium text-[15px] transition-colors"
          >
            I have an account
          </Link>
        </div>

        <p className="text-center text-[11px] text-slate pb-4">
          One property free&nbsp;&middot;&nbsp;No card required
        </p>
      </div>
    </div>
  );
}
