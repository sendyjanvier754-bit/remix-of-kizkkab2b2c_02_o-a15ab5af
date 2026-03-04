import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '@/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  /** Show only the flag + current language code (compact mode) */
  compact?: boolean;
  variant?: 'default' | 'ghost' | 'outline';
}

export function LanguageSwitcher({ compact = false, variant = 'ghost' }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)
    ?? SUPPORTED_LANGUAGES[0];

  const handleChange = (code: SupportedLanguage) => {
    i18n.changeLanguage(code);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" className="gap-2">
          {compact ? (
            <>
              <span>{currentLang.flag}</span>
              <span className="uppercase text-xs font-semibold">{currentLang.code}</span>
            </>
          ) : (
            <>
              <Globe className="h-4 w-4" />
              <span>{currentLang.flag} {currentLang.label}</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChange(lang.code)}
            className={`gap-2 cursor-pointer ${lang.code === i18n.language ? 'font-semibold bg-accent' : ''}`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSwitcher;
