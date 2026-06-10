import { storagePublicUrlForBrowser } from '../utils/storagePublicUrl';
import type { ReviewBookingProfessional } from '../lib/reviewQuestions';

type ReviewProfessionalSelectorProps = {
  professionals: ReviewBookingProfessional[];
  selectedId: string | null;
  onSelect: (professionalId: string) => void;
  disabled?: boolean;
};

export function ReviewProfessionalSelector({
  professionals,
  selectedId,
  onSelect,
  disabled = false,
}: ReviewProfessionalSelectorProps) {
  if (professionals.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm text-white/80 mb-1">Qual profissional te atendeu?</label>
        <p className="text-xs text-white/50">Toque no profissional que fez seu atendimento.</p>
      </div>

      <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
        {professionals.map((professional) => {
          const selected = selectedId === professional.id;
          return (
            <button
              key={professional.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(professional.id)}
              className={`flex flex-col items-center flex-shrink-0 rounded-xl p-2 transition-all ${
                selected
                  ? 'bg-[#E6C78B]/15 ring-2 ring-[#E6C78B]'
                  : 'bg-black/30 border border-white/10 hover:border-white/25'
              } disabled:opacity-60`}
              aria-pressed={selected}
              aria-label={`Profissional ${professional.name}`}
            >
              <div
                className="relative w-16 h-16 rounded-full overflow-hidden"
                style={{
                  border: selected ? '2px solid #E6C78B' : '2px solid rgba(230,199,139,0.45)',
                }}
              >
                <img
                  src={storagePublicUrlForBrowser(professional.photo_url) || '/fotopessoa.png'}
                  alt={professional.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/fotopessoa.png';
                  }}
                />
              </div>
              <span
                className={`mt-2 text-xs font-semibold text-center max-w-[88px] truncate ${
                  selected ? 'text-[#E6C78B]' : 'text-white/85'
                }`}
              >
                {professional.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
