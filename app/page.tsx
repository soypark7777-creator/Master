import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stage-radial px-6 text-white">
      <div className="max-w-2xl rounded-[2rem] border border-white/10 bg-white/5 p-10 shadow-stage backdrop-blur">
        <p className="text-sm uppercase tracking-[0.4em] text-gold-200/80">
          SoulTree Vision
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
          Real-time Concert Analysis Console
        </h1>
        <p className="mt-4 text-base leading-7 text-white/70">
          박효신 콘서트 감성의 실시간 분석 대시보드를 준비했습니다.
        </p>
        <Link
          href="/analysis"
          className="mt-8 inline-flex items-center rounded-full border border-gold-300/50 bg-gold-300/10 px-6 py-3 text-sm font-medium text-gold-100 transition hover:border-gold-200 hover:bg-gold-300/20"
        >
          Open Analysis Dashboard
        </Link>
      </div>
    </main>
  );
}
