import { Link } from "react-router-dom";
import { MapPin, Phone, Mail, Facebook, Instagram } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBranding } from "@/hooks/useBranding";

const PaymentIcon = ({ src, alt, fallback }: { src: string; alt: string; fallback: React.ReactNode }) => {
  if (src) return <img src={src} alt={alt} className="h-6 w-auto" />;
  return <>{fallback}</>;
};

const Footer = () => {
  const { t } = useTranslation();
  const { getValue } = useBranding();
  const platformName = getValue('platform_name');
  const contactEmail = getValue('contact_email');
  const contactPhone = getValue('contact_phone');

  return (
    <footer className="hidden md:block bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
          <div>
            <h4 className="font-bold text-lg mb-4">{platformName}</h4>
            <p className="text-gray-400 text-sm">{t('footer.tagline')}</p>
            <Link to="/sobre-nosotros" className="text-sm text-gray-400 hover:text-white transition mt-3 inline-block">
              {t('footerExtra.aboutUs')}
            </Link>
          </div>

          <div>
            <h4 className="font-bold mb-4">{t('footer.shopping')}</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/marketplace" className="hover:text-white transition">{t('footer.justForYou')}</Link></li>
              <li><Link to="/tendencias" className="hover:text-white transition">{t('footer.newArrivals')}</Link></li>
              <li><Link to="/marketplace" className="hover:text-white transition">{t('footer.deals')}</Link></li>
              <li><Link to="/categorias" className="hover:text-white transition">{t('footer.womenClothing')}</Link></li>
              <li><Link to="/categorias" className="hover:text-white transition">{t('footer.menClothing')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4">{t('footer.categories')}</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/categorias" className="hover:text-white transition">{t('footer.accessories')}</Link></li>
              <li><Link to="/categorias" className="hover:text-white transition">{t('footer.shoes')}</Link></li>
              <li><Link to="/categorias" className="hover:text-white transition">{t('footer.beauty')}</Link></li>
              <li><Link to="/categorias" className="hover:text-white transition">{t('footer.homeLife')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4">{t('footer.account')}</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/perfil" className="hover:text-white transition">{t('footer.myAccount')}</Link></li>
              <li><Link to="/mis-compras" className="hover:text-white transition">{t('footer.myOrders')}</Link></li>
              <li><Link to="/favoritos" className="hover:text-white transition">{t('footer.favorites')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4">{t('footer.contact')}</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href={`tel:${contactPhone}`} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
                  <Phone className="w-4 h-4" />{contactPhone || '+1 (509) 3234-5678'}
                </a>
              </li>
              <li>
                <a href={`mailto:${contactEmail}`} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
                  <Mail className="w-4 h-4" />{contactEmail || 'contacto@empresa.com'}
                </a>
              </li>
              <li className="flex items-center gap-2 text-gray-400">
                <MapPin className="w-4 h-4" />Puerto Príncipe, Haití
              </li>
              <li>
                <Link to="/contacto" className="text-gray-400 hover:text-white transition text-xs">
                  {t('footerExtra.allChannels')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-400 mb-6">
            <div>
              <h5 className="font-semibold text-white mb-2">✓ {getValue('trust_badge_1_title') || t('footer.shippingAbroad')}</h5>
              <p>{getValue('trust_badge_1_desc') || t('footer.shippingDays')}</p>
            </div>
            <div>
              <h5 className="font-semibold text-white mb-2">✓ {getValue('trust_badge_2_title') || t('footer.freeReturns')}</h5>
              <p>{getValue('trust_badge_2_desc') || t('footer.returnDays')}</p>
            </div>
            <div>
              <h5 className="font-semibold text-white mb-2">✓ {getValue('trust_badge_3_title') || t('footer.securePayment')}</h5>
              <p>{getValue('trust_badge_3_desc') || t('footer.multiplePayments')}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 py-6">
          <p className="text-sm font-semibold text-white mb-4">{t('common.acceptedPaymentMethods')}</p>
          <div className="grid grid-cols-5 gap-4 md:gap-6 max-w-2xl">
            <div className="flex flex-col items-center gap-2">
              <PaymentIcon src={getValue('payment_icon_visa')} alt="VISA" fallback={<img src="/visa.png" alt="VISA" className="h-6 w-auto" />} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <PaymentIcon src={getValue('payment_icon_mastercard')} alt="Mastercard" fallback={<img src="/mastercard.png" alt="Mastercard" className="h-6 w-auto" />} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <PaymentIcon src={getValue('payment_icon_amex')} alt="American Express" fallback={<img src="/american express.png" alt="American Express" className="h-6 w-auto" />} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <PaymentIcon src={getValue('payment_icon_applepay')} alt="Apple Pay" fallback={<img src="/apple pay.png" alt="Apple Pay" className="h-6 w-auto" />} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <PaymentIcon src={getValue('payment_icon_googlepay')} alt="Google Pay" fallback={<img src="/google pay.png" alt="Google Pay" className="h-6 w-auto" />} />
            </div>
            <div className="flex flex-col items-center gap-2">
              {getValue('payment_icon_transfer') ? (
                <img src={getValue('payment_icon_transfer')} alt="Transferencia" className="h-6 w-auto" />
              ) : (
                <div className="flex items-center justify-center px-2 py-1 rounded" style={{ backgroundColor: 'white' }}>
                  <span className="text-[9px] font-bold" style={{ color: '#071d7f' }}>{t('common.transfer')}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              {getValue('payment_icon_moncash') ? (
                <img src={getValue('payment_icon_moncash')} alt="MonCash" className="h-8 w-auto" />
              ) : (
                <>
                  <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: '#94111f' }}>
                    <span className="text-[9px] font-bold text-white">MC</span>
                  </div>
                  <span className="text-xs font-bold" style={{ color: '#94111f' }}>MonCash</span>
                </>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              {getValue('payment_icon_natcash') ? (
                <img src={getValue('payment_icon_natcash')} alt="NatCash" className="h-8 w-auto" />
              ) : (
                <>
                  <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: '#1e40af' }}>
                    <span className="text-[9px] font-bold text-white">NC</span>
                  </div>
                  <span className="text-xs font-bold" style={{ color: '#1e40af' }}>NatCash</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
          <p>{t('common.allRightsReserved', { year: new Date().getFullYear(), name: getValue('platform_name') || 'SIVER Market' })}</p>

          {/* Social media icons */}
          {(getValue('social_facebook') || getValue('social_instagram') || getValue('social_whatsapp')) && (
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              {getValue('social_facebook') && (
                <a
                  href={getValue('social_facebook')}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="hover:text-white transition p-1.5 rounded-full hover:bg-white/10"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              )}
              {getValue('social_instagram') && (
                <a
                  href={getValue('social_instagram')}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="hover:text-white transition p-1.5 rounded-full hover:bg-white/10"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {getValue('social_whatsapp') && (
                <a
                  href={`https://wa.me/${getValue('social_whatsapp').replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="hover:text-white transition p-1.5 rounded-full hover:bg-white/10"
                >
                  {/* WhatsApp SVG inline (no hay icono en lucide-react) */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </a>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-4 mt-4 md:mt-0 justify-center md:justify-end">
            <Link to="/terminos" className="hover:text-white transition">{t('common.termsConditions')}</Link>
            <Link to="/privacidad" className="hover:text-white transition">{t('common.privacyPolicy')}</Link>
            <Link to="/cookies" className="hover:text-white transition">{t('common.cookiePolicy')}</Link>
            <Link to="/devoluciones" className="hover:text-white transition">Devoluciones</Link>
            <Link to="/reembolsos" className="hover:text-white transition">Reembolsos</Link>
            <Link to="/cambios" className="hover:text-white transition">Cambios</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
