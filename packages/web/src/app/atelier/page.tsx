import { AtelierWorkspace } from '@/components/atelier/AtelierWorkspace';
export default function AtelierPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return (
    <AtelierWorkspace
      initialThreadId={typeof searchParams.from === 'string' ? searchParams.from : ''}
      initialDesignId={typeof searchParams.design === 'string' ? searchParams.design : ''}
    />
  );
}
