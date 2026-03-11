import { Download, Copy, Check, BookOpen, ChevronDown, Link, LogOut, Globe } from 'lucide-react'
import { useDropdown } from '../hooks/useDropdown.js'
import { useT, useI18n } from '../lib/i18n.jsx'

export default function Header({
  user,
  shared,
  onShare,
  onExportSVG,
  onExportPNG,
  onCopyDSL,
  copied,
  onOpenExamples,
  onLogin,
  onLogout,
}) {
  const t = useT()
  const { lang, setLang } = useI18n()

  const [exportOpen, setExportOpen, exportRef] = useDropdown()
  const [accountOpen, setAccountOpen, accountRef] = useDropdown()

  return (
    <header className="flex items-center justify-between px-4 py-2 shrink-0 bg-white border-b border-slate-200">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base tracking-tight text-slate-800">Skemly</span>
          <span className="text-xs opacity-50 hidden md:inline text-slate-800">v1.1</span>
        </div>
        <button
          onClick={onOpenExamples}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <BookOpen size={12} />
          <span className="hidden md:inline">{t('examples')}</span>
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5">
        {/* Share */}
        <button
          onClick={onShare}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
          title={t('copy_shareable_link')}
        >
          {shared ? <Check size={12} /> : <Link size={12} />}
          <span>{shared ? t('copied') : t('share')}</span>
        </button>

        {/* Export dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(o => !o)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Download size={12} />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown size={10} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 rounded-lg shadow-lg border z-50 overflow-hidden bg-white border-slate-200">
              {[
                { label: t('copy_dsl'), icon: Copy,     action: () => { onCopyDSL(); setExportOpen(false) } },
                { label: 'SVG',         icon: Download,  action: () => { onExportSVG(); setExportOpen(false) } },
                { label: 'PNG',         icon: Download,  action: () => { onExportPNG(); setExportOpen(false) } },
              ].map(({ label, icon: Icon, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-slate-700 hover:bg-slate-50"
                >
                  <Icon size={11} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Account dropdown */}
        <div className="relative" ref={accountRef}>
          <button
            onClick={() => setAccountOpen(o => !o)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${user ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
          >
            {user ? (
              <>
                <span className="max-w-[80px] truncate hidden sm:inline">
                  {user.name || user.email.split('@')[0]}
                </span>
                <ChevronDown size={10} className={`transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
              </>
            ) : (
              <span>{t('sign_in')}</span>
            )}
          </button>
          {accountOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-lg shadow-lg border z-50 overflow-hidden bg-white border-slate-200">
              <button
                onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-slate-700 hover:bg-slate-50"
              >
                <Globe size={11} />
                {lang === 'en' ? 'Español' : 'English'}
              </button>
              <div className="border-t mx-2 border-slate-100" />
              {user ? (
                <button
                  onClick={() => { onLogout(); setAccountOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-slate-700 hover:bg-slate-50"
                >
                  <LogOut size={11} />
                  {t('sign_out')}
                </button>
              ) : (
                <button
                  onClick={() => { onLogin(); setAccountOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-slate-700 hover:bg-slate-50"
                >
                  <LogOut size={11} className="rotate-180" />
                  {t('sign_in')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
