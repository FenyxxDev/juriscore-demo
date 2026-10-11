import { Construction } from 'lucide-react';
import { Card, EmptyState } from '../components/ui';

export function EmBreve({ titulo }: { titulo: string }) {
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-7 md:px-8">
      <h1 className="mb-6 text-[28px] font-semibold text-ink">{titulo}</h1>
      <Card>
        <EmptyState
          icon={<Construction size={26} />}
          title="Em construção"
          description="Esta tela será desenvolvida pela equipe a partir dos componentes reutilizáveis do JurisCore."
        />
      </Card>
    </div>
  );
}
