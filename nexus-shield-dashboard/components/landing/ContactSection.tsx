import { MessageCircle } from 'lucide-react';
import { ContactEmail } from '@/components/landing/ContactEmail';

export function ContactSection() {
  return (
    <section id="contact" className="scroll-mt-20 border-t border-white/5 bg-zinc-900/30 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-300">
          <MessageCircle className="h-3.5 w-3.5" />
          İletişim
        </div>

        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Bizimle iletişime geçin
        </h2>

        <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-500 sm:text-base">
          Kurumsal sorularınız, demo talepleri ve ortaklık fırsatları için ekibimize doğrudan
          ulaşabilirsiniz.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4">
          <ContactEmail variant="section" />
          <p className="text-xs text-zinc-600">
            E-posta bağlantısına tıklayarak varsayılan posta uygulamanızı açabilir veya kopyala
            düğmesiyle adresi panoya alabilirsiniz.
          </p>
        </div>
      </div>
    </section>
  );
}
