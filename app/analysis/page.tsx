import { AnalysisDashboard } from "@/components/AnalysisDashboard";

type AnalysisPageProps = {
  searchParams?: {
    url?: string;
  };
};

export default function AnalysisPage({ searchParams }: AnalysisPageProps) {
  const streamUrl =
    searchParams?.url ?? process.env.NEXT_PUBLIC_ANALYSIS_STREAM_URL;

  return <AnalysisDashboard initialStreamSourceUrl={streamUrl} />;
}
