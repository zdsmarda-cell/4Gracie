
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { ShoppingCart, User, Menu as MenuIcon, X } from 'lucide-react';
import { Language } from '../types';

export const Navbar: React.FC = () => {
  const { cart, language, setLanguage, user, t, logout, openAuthModal } = useStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          
          {/* Logo Removed as requested */}
          <div className="flex items-center">
             {/* Empty container or removed img */}
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-accent font-medium transition">{t('nav.menu')}</Link>
            {/* Driver tab deactivated as requested */}
            {/* {(user?.role === 'driver' || user?.role === 'admin') && (
              <Link to="/driver" className="text-gray-700 hover:text-accent font-medium transition">{t('nav.driver')}</Link>
            )} */}
            {user?.role === 'admin' && (
              <Link to="/admin" className="text-red-600 font-bold hover:text-red-800 transition">{t('nav.admin')}</Link>
            )}
            
            {/* Language Switcher */}
            <div className="flex space-x-2 text-sm">
              {(Object.values(Language) as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-2 py-1 rounded ${language === lang ? 'bg-gray-200 font-bold' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Auth */}
            {user ? (
               <div className="flex items-center space-x-4">
                 <Link to="/profile" className="flex items-center text-gray-700 hover:text-accent">
                   <User size={20} className="mr-1" />
                   <span className="text-sm font-medium">{user.name}</span>
                 </Link>
                 <button onClick={logout} className="text-xs text-gray-500 underline">Log out</button>
               </div>
            ) : (
              <button onClick={openAuthModal} className="text-gray-700 hover:text-accent font-medium">
                {t('nav.login')}
              </button>
            )}

            {/* Cart */}
            <Link to="/cart" className="relative p-2 text-gray-700 hover:text-accent">
              <ShoppingCart size={24} />
              {totalItems > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-accent rounded-full">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-700">
              {isMobileMenuOpen ? <X size={28} /> : <MenuIcon size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
             <Link to="/" className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-accent" onClick={() => setIsMobileMenuOpen(false)}>{t('nav.menu')}</Link>
             <Link to="/cart" className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-accent" onClick={() => setIsMobileMenuOpen(false)}>{t('nav.cart')}</Link>
             {/* Driver tab deactivated
             {(user?.role === 'driver' || user?.role === 'admin') && (
                <Link to="/driver" className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-accent" onClick={() => setIsMobileMenuOpen(false)}>{t('nav.driver')}</Link>
             )} */}
             {user?.role === 'admin' && (
                <Link to="/admin" className="block px-3 py-2 text-base font-medium text-red-600" onClick={() => setIsMobileMenuOpen(false)}>{t('nav.admin')}</Link>
             )}
             {!user && (
               <button onClick={() => { openAuthModal(); setIsMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700">
                 {t('nav.login')}
               </button>
             )}
          </div>
        </div>
      )}
    </nav>
  );
};
