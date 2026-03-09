import { Link } from "react-router-dom";
import { MapPin, Phone, Mail } from "lucide-react";
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
              Sobre nosotros →
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
                  Ver todos los canales →
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
          <div className="flex gap-6 mt-4 md:mt-0">
            <Link to="/terminos" className="hover:text-white transition">{t('common.termsConditions')}</Link>
            <Link to="/privacidad" className="hover:text-white transition">{t('common.privacyPolicy')}</Link>
            <Link to="/cookies" className="hover:text-white transition">{t('common.cookiePolicy')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
